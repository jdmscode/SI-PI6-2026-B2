import torch
import torchvision
import matplotlib.pyplot as plt
import seaborn as sns
import sys
import traceback
import random
import numpy as np

from datetime import datetime
from torchvision import datasets, transforms
from torch import nn, optim
from torch.utils.data import DataLoader, Subset
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_auc_score
)
from tqdm import tqdm


class RegistrarSaida:
    def __init__(self, *saidas):
        self.saidas = saidas

    def write(self, texto):
        for saida in self.saidas:
            saida.write(texto)
            saida.flush()

    def flush(self):
        for saida in self.saidas:
            saida.flush()

    def isatty(self):
        return any(
            getattr(saida, "isatty", lambda: False)()
            for saida in self.saidas
        )


nome_arquivo_resultados = (
    f"resultado_melanoma_swin_t_"
    f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt"
)

arquivo_resultados = open(nome_arquivo_resultados, "w", encoding="utf-8")

saida_original = sys.stdout
erro_original = sys.stderr

sys.stdout = RegistrarSaida(saida_original, arquivo_resultados)
sys.stderr = RegistrarSaida(erro_original, arquivo_resultados)


try:

    # Reprodutibilidade

    semente = 42

    random.seed(semente)
    np.random.seed(semente)
    torch.manual_seed(semente)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(semente)

    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

    dispositivo_processamento = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print(f"Dispositivo utilizado: {dispositivo_processamento}")

    # Preparação das imagens (224x224 obrigatório para Swin)

    preparacao_das_imagens = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])

    # Carregamento dos datasets

    conjunto_de_dados_completo = datasets.ImageFolder(
        "../../melanoma_cancer_dataset/train",
        transform=preparacao_das_imagens
    )

    conjunto_de_dados_teste = datasets.ImageFolder(
        "../../melanoma_cancer_dataset/test",
        transform=preparacao_das_imagens
    )

    print(conjunto_de_dados_completo.class_to_idx)

    if conjunto_de_dados_completo.class_to_idx != {"benign": 0, "malignant": 1}:
        raise ValueError("Verifique o mapeamento das classes do treinamento.")

    if conjunto_de_dados_teste.class_to_idx != {"benign": 0, "malignant": 1}:
        raise ValueError("Verifique o mapeamento das classes do teste.")

    # Divisão estratificada 80% treino e 20% validação

    todos_os_rotulos = np.array(conjunto_de_dados_completo.targets)

    indices = np.arange(len(conjunto_de_dados_completo))

    indices_treino, indices_validacao = train_test_split(
        indices,
        test_size=0.20,
        random_state=semente,
        stratify=todos_os_rotulos
    )

    subconjunto_treino = Subset(
        conjunto_de_dados_completo,
        indices_treino
    )

    subconjunto_validacao = Subset(
        conjunto_de_dados_completo,
        indices_validacao
    )

    gerador = torch.Generator()
    gerador.manual_seed(semente)

    carregador_lotes_treino = DataLoader(
        subconjunto_treino,
        batch_size=32,
        shuffle=True,
        generator=gerador,
        num_workers=0
    )

    carregador_lotes_validacao = DataLoader(
        subconjunto_validacao,
        batch_size=32,
        shuffle=False,
        num_workers=0
    )

    carregador_lotes_teste = DataLoader(
        conjunto_de_dados_teste,
        batch_size=32,
        shuffle=False,
        num_workers=0
    )

    print(f"Imagens para treino: {len(subconjunto_treino)}")
    print(f"Imagens para validação: {len(subconjunto_validacao)}")
    print(f"Imagens para teste: {len(conjunto_de_dados_teste)}")

    # Implementação do Swin Transformer Tiny

    modelo_rede_neural = torchvision.models.swin_t(
        weights="DEFAULT"
    )

    # Congelamento da base

    for param in modelo_rede_neural.parameters():
        param.requires_grad = False

    # Substituição da camada final

    in_features = modelo_rede_neural.head.in_features

    modelo_rede_neural.head = nn.Sequential(
        nn.Dropout(p=0.5),
        nn.Linear(in_features, 2)
    )

    modelo_rede_neural.to(dispositivo_processamento)

    # Configurações de aprendizado

    taxa_de_aprendizado = 0.0001

    funcao_calculo_de_erro = nn.CrossEntropyLoss()

    otimizador_de_pesos = optim.Adam(
        modelo_rede_neural.head.parameters(),
        lr=taxa_de_aprendizado,
        weight_decay=1e-4
    )

    limite_de_paciencia = 3
    menor_erro_validacao = float("inf")
    contador_epocas_sem_melhoria = 0
    limite_de_epocas = 20

    historico_erro_treino = []
    historico_erro_validacao = []

    # Treinamento

    for epoca_atual in range(limite_de_epocas):

        modelo_rede_neural.eval()
        modelo_rede_neural.head.train()

        soma_erros_treino = 0.0
        total_imagens_treino = 0

        barra_progresso_treino = tqdm(
            carregador_lotes_treino,
            desc=f"Época {epoca_atual+1}/{limite_de_epocas} [Treinamento]",
            file=erro_original
        )

        for lote_imagens, lote_gabaritos_reais in barra_progresso_treino:

            lote_imagens = lote_imagens.to(dispositivo_processamento)
            lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

            previsoes_do_modelo = modelo_rede_neural(lote_imagens)

            erro_deste_lote = funcao_calculo_de_erro(
                previsoes_do_modelo,
                lote_gabaritos_reais
            )

            otimizador_de_pesos.zero_grad()
            erro_deste_lote.backward()
            otimizador_de_pesos.step()

            quantidade_imagens = lote_imagens.size(0)

            soma_erros_treino += erro_deste_lote.item() * quantidade_imagens
            total_imagens_treino += quantidade_imagens

            barra_progresso_treino.set_postfix(
                erro=f"{erro_deste_lote.item():.4f}"
            )

        media_erro_treino = soma_erros_treino / total_imagens_treino

        historico_erro_treino.append(media_erro_treino)

        # Validação

        modelo_rede_neural.eval()

        soma_erros_validacao = 0.0
        total_imagens_validacao = 0

        barra_progresso_validacao = tqdm(
            carregador_lotes_validacao,
            desc=f"Época {epoca_atual+1}/{limite_de_epocas} [Validação]",
            leave=False,
            file=erro_original
        )

        with torch.no_grad():

            for lote_imagens, lote_gabaritos_reais in barra_progresso_validacao:

                lote_imagens = lote_imagens.to(dispositivo_processamento)
                lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

                previsoes_do_modelo = modelo_rede_neural(lote_imagens)

                erro_deste_lote = funcao_calculo_de_erro(
                    previsoes_do_modelo,
                    lote_gabaritos_reais
                )

                quantidade_imagens = lote_imagens.size(0)

                soma_erros_validacao += erro_deste_lote.item() * quantidade_imagens
                total_imagens_validacao += quantidade_imagens

        media_erro_validacao = soma_erros_validacao / total_imagens_validacao

        historico_erro_validacao.append(media_erro_validacao)

        print(
            f"Época {epoca_atual+1} concluída | "
            f"Erro médio (Treino): {media_erro_treino:.4f} | "
            f"Erro médio (Validação): {media_erro_validacao:.4f}"
        )

        # Early Stopping

        if media_erro_validacao < menor_erro_validacao:

            print(
                f"O erro de validação caiu de "
                f"{menor_erro_validacao:.4f} para "
                f"{media_erro_validacao:.4f}. Salvando modelo."
            )

            menor_erro_validacao = media_erro_validacao

            torch.save(
                modelo_rede_neural.state_dict(),
                "melhor_modelo_swin_t.pth"
            )

            contador_epocas_sem_melhoria = 0

        else:

            contador_epocas_sem_melhoria += 1

            print(
                f"O modelo não melhorou. Contagem: "
                f"{contador_epocas_sem_melhoria} de {limite_de_paciencia}."
            )

            if contador_epocas_sem_melhoria >= limite_de_paciencia:

                print("Early Stopping ativado.")

                break

    print("Treinamento finalizado.")

    # Carregamento do melhor modelo

    modelo_rede_neural.load_state_dict(
        torch.load(
            "melhor_modelo_swin_t.pth",
            map_location=dispositivo_processamento,
            weights_only=True
        )
    )

    modelo_rede_neural.eval()

    # Teste final

    print("\nTeste final")

    acertos_teste = 0
    total_imagens_teste = 0

    todas_as_previsoes = []
    todos_os_gabaritos = []
    todas_as_probabilidades_malignas = []

    with torch.inference_mode():

        barra_progresso_teste = tqdm(
            carregador_lotes_teste,
            desc="Avaliando Teste Final",
            file=erro_original
        )

        for lote_imagens, lote_gabaritos_reais in barra_progresso_teste:

            lote_imagens = lote_imagens.to(dispositivo_processamento)
            lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

            previsoes_do_modelo = modelo_rede_neural(lote_imagens)

            probabilidades = torch.softmax(previsoes_do_modelo, dim=1)

            todas_as_probabilidades_malignas.extend(
                probabilidades[:, 1].cpu().numpy()
            )

            _, classe_escolhida = torch.max(previsoes_do_modelo, 1)

            total_imagens_teste += lote_gabaritos_reais.size(0)

            acertos_teste += (
                classe_escolhida == lote_gabaritos_reais
            ).sum().item()

            todas_as_previsoes.extend(classe_escolhida.cpu().numpy())
            todos_os_gabaritos.extend(lote_gabaritos_reais.cpu().numpy())

    if total_imagens_teste == 0:
        raise ValueError("O conjunto de teste está vazio.")

    acuracia_teste = (acertos_teste / total_imagens_teste) * 100

    print(
        f"\nResultado do Teste Final: "
        f"{acuracia_teste:.2f}% de acurácia."
    )

    # Métricas

    matriz = confusion_matrix(
        todos_os_gabaritos,
        todas_as_previsoes,
        labels=[0, 1]
    )

    relatorio = classification_report(
        todos_os_gabaritos,
        todas_as_previsoes,
        labels=[0, 1],
        target_names=["benign (0)", "malignant (1)"],
        zero_division=0
    )

    verdadeiros_negativos = matriz[0, 0]
    falsos_positivos = matriz[0, 1]

    verdadeiros_positivos = matriz[1, 1]
    falsos_negativos = matriz[1, 0]

    especificidade = (
        verdadeiros_negativos / (verdadeiros_negativos + falsos_positivos)
        if (verdadeiros_negativos + falsos_positivos) > 0
        else float("nan")
    )

    sensibilidade = (
        verdadeiros_positivos / (verdadeiros_positivos + falsos_negativos)
        if (verdadeiros_positivos + falsos_negativos) > 0
        else float("nan")
    )

    if len(np.unique(todos_os_gabaritos)) == 2:

        auc_roc = roc_auc_score(
            todos_os_gabaritos,
            todas_as_probabilidades_malignas
        )

    else:
        auc_roc = float("nan")

    print(f"Sensibilidade: {sensibilidade * 100:.2f}%")
    print(f"Especificidade: {especificidade * 100:.2f}%")
    print(f"AUC-ROC: {auc_roc:.4f}")

    print("\nMatriz de confusão - Swin Transformer Tiny")
    print("Eixo vertical: Realidade | Eixo horizontal: Previsão da IA\n")
    print(matriz)

    print("\nRelatório de classificação")
    print(relatorio)

    # Gráfico da matriz de confusão

    plt.figure(figsize=(8, 6))

    sns.heatmap(
        matriz,
        annot=True,
        fmt="d",
        cmap="Greens",
        xticklabels=["benign (0)", "malignant (1)"],
        yticklabels=["benign (0)", "malignant (1)"]
    )

    plt.ylabel("Realidade (Gabarito)")
    plt.xlabel("Previsão da IA")
    plt.title("Matriz de confusão - Swin Transformer Tiny")

    plt.tight_layout()

    plt.savefig(
        "grafico_matriz_confusao_swin_t.png",
        dpi=300,
        bbox_inches="tight"
    )

    plt.close()

    print("\nGráfico da matriz de confusão salvo.")

    # Gráfico das perdas

    plt.figure(figsize=(9, 6))

    plt.plot(
        range(1, len(historico_erro_treino) + 1),
        historico_erro_treino,
        label="Treinamento"
    )

    plt.plot(
        range(1, len(historico_erro_validacao) + 1),
        historico_erro_validacao,
        label="Validação"
    )

    plt.xlabel("Épocas")
    plt.ylabel("Erro (Loss)")
    plt.title("Curva de aprendizado - Swin Transformer Tiny")
    plt.legend()
    plt.grid(alpha=0.3)

    plt.tight_layout()

    plt.savefig(
        "grafico_perdas_swin_t.png",
        dpi=300,
        bbox_inches="tight"
    )

    plt.close()

    print("\nGráfico das perdas salvo.")

    print(f"\nResultados salvos em: {nome_arquivo_resultados}")

except Exception:

    traceback.print_exc()
    raise

finally:

    sys.stdout = saida_original
    sys.stderr = erro_original

    arquivo_resultados.close()

