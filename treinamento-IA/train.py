import torch
import torchvision
import matplotlib.pyplot as plt
import seaborn as sns
import sys
import traceback
from datetime import datetime
from torchvision import datasets, transforms
from torch import nn, optim
from torch.utils.data import random_split, DataLoader
from tqdm import tqdm
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_auc_score
)


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


# cria um arquivo txt com a data e hora da execução pra guardar os resultados
nome_arquivo_resultados = f"resultado_melanoma_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt"
arquivo_resultados = open(nome_arquivo_resultados, "w", encoding="utf-8")

# guarda tudo que for exibido no terminal também no arquivo txt
saida_original = sys.stdout
erro_original = sys.stderr
sys.stdout = RegistrarSaida(saida_original, arquivo_resultados)
sys.stderr = RegistrarSaida(erro_original, arquivo_resultados)

try:

    # define onde os cálculos serão feitos (gpu se disponível, do contrário, processador comum)
    dispositivo_processamento = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Dispositivo utilizado: {dispositivo_processamento}")

    # redimensionamento das imagens (sem rotacao hehe) e conversão para tipo que o pytorch entenda, no caso, tensor
    preparacao_das_imagens = transforms.Compose([
        transforms.Resize((300, 300)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])

    # carregamento do dataset inteiro
    conjunto_de_dados_completo = datasets.ImageFolder("../melanoma_cancer_dataset/train", transform=preparacao_das_imagens)

    print(conjunto_de_dados_completo.class_to_idx)

    # separa 80% do dataset para treino e 20% para validação
    quantidade_imagens_treino = int(0.8 * len(conjunto_de_dados_completo))
    quantidade_imagens_validacao = len(conjunto_de_dados_completo) - quantidade_imagens_treino

    torch.manual_seed(42)

    # separacao das imagens de forma randomica em dois grupos
    subconjunto_treino, subconjunto_validacao = random_split(
        conjunto_de_dados_completo,
        [quantidade_imagens_treino, quantidade_imagens_validacao]
    )

    conjunto_de_dados_teste = datasets.ImageFolder("../melanoma_cancer_dataset/test", transform=preparacao_das_imagens)

    # divisão de carga para o carregamento de imagens não sobrecarregar a memória, em lotes de 32
    carregador_lotes_treino = DataLoader(subconjunto_treino, batch_size=32, shuffle=True)
    carregador_lotes_validacao = DataLoader(subconjunto_validacao, batch_size=32, shuffle=False)
    carregador_lotes_teste = DataLoader(conjunto_de_dados_teste, batch_size=32, shuffle=False)

    print(f"Imagens para treino: {len(subconjunto_treino)}")
    print(f"Imagens para validação: {len(subconjunto_validacao)}")
    print(f"Imagens para teste: {len(conjunto_de_dados_teste)}")

    # implementa o modelo efficientnetb3
    modelo_rede_neural = torchvision.models.efficientnet_b3(weights="DEFAULT")

    # congela a base de conhecimento do modelo (evita overfitting)
    for param in modelo_rede_neural.features.parameters():
        param.requires_grad = False

    # aumenta a dificuldade de memorização (dropout de 50%)
    modelo_rede_neural.classifier[0] = nn.Dropout(p=0.5, inplace=True)

    # cria o filtro para separação em 2 opções, com melanoma/sem melanoma
    modelo_rede_neural.classifier[1] = nn.Linear(modelo_rede_neural.classifier[1].in_features, 2)
    modelo_rede_neural.to(dispositivo_processamento)

    # calculos para aprendizado
    taxa_de_aprendizado = 0.0001
    funcao_calculo_de_erro = nn.CrossEntropyLoss()

    # otimizador treina só o classificador final e aplica weight decay
    otimizador_de_pesos = optim.Adam(
        modelo_rede_neural.classifier.parameters(),
        lr=taxa_de_aprendizado,
        weight_decay=1e-4
    )

    # limitadores de segurança para evitar que o modelo apenas decore
    limite_de_paciencia = 3
    menor_erro_validacao = float('inf')  # infinito para que o erro da 1ª época sempre seja considerado o menor
    contador_epocas_sem_melhoria = 0
    limite_de_epocas = 20

    # treinamento
    for epoca_atual in range(limite_de_epocas):

        modelo_rede_neural.train()  # coloca em modo de treino
        modelo_rede_neural.features.eval()
        soma_erros_treino = 0
        barra_progresso_treino = tqdm(carregador_lotes_treino, desc=f"Época {epoca_atual+1}/{limite_de_epocas} [Treinamento]", file=erro_original)

        # grupo de 32 imagens e o gabarito correto de cada uma
        for lote_imagens, lote_gabaritos_reais in barra_progresso_treino:
            lote_imagens = lote_imagens.to(dispositivo_processamento)
            lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

            # adivinhar o que tem nas imagens
            previsoes_do_modelo = modelo_rede_neural(lote_imagens)

            # compara com o gabarito real para descobrir a pontuação do erro
            erro_deste_lote = funcao_calculo_de_erro(previsoes_do_modelo, lote_gabaritos_reais)

            # limpa fragmentos antigos, calcula o ajuste, e aplica a correção
            otimizador_de_pesos.zero_grad()
            erro_deste_lote.backward()
            otimizador_de_pesos.step()

            # valor de erros para media no final da epoca
            soma_erros_treino += erro_deste_lote.item()
            barra_progresso_treino.set_postfix(erro=erro_deste_lote.item())

        media_erro_treino = soma_erros_treino / len(carregador_lotes_treino)

        # validacao final
        modelo_rede_neural.eval()  # agora apenas validacao (evaluation)
        soma_erros_validacao = 0
        barra_progresso_validacao = tqdm(carregador_lotes_validacao, desc=f"Época {epoca_atual+1}/{limite_de_epocas} [Validacao]", leave=False, file=erro_original)

        with torch.no_grad():  # funcao para desativar o calculo de gradiente
            for lote_imagens, lote_gabaritos_reais in barra_progresso_validacao:
                lote_imagens = lote_imagens.to(dispositivo_processamento)
                lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

                previsoes_do_modelo = modelo_rede_neural(lote_imagens)
                erro_deste_lote = funcao_calculo_de_erro(previsoes_do_modelo, lote_gabaritos_reais)

                soma_erros_validacao += erro_deste_lote.item()

        media_erro_validacao = soma_erros_validacao / len(carregador_lotes_validacao)

        print(f"Época {epoca_atual+1} concluída | Erro médio (Treino): {media_erro_treino:.4f} | Erro médio (Validação): {media_erro_validacao:.4f}")

        if media_erro_validacao < menor_erro_validacao:
            # se pontuação de erro diminuiu, modelo ficou mais inteligente
            print(f"O erro de validação caiu de {menor_erro_validacao:.4f} para {media_erro_validacao:.4f}. O modelo melhorou, salvando arquivo")
            menor_erro_validacao = media_erro_validacao
            torch.save(modelo_rede_neural.state_dict(), "melhor_modelo.pth")
            contador_epocas_sem_melhoria = 0  # zera a contagem de alerta porque teve evolução
        else:
            # se a pontuação de erro subiu ou empatou, o modelo empacou
            contador_epocas_sem_melhoria += 1
            print(f"O modelo não melhorou. Contagem de limite: {contador_epocas_sem_melhoria} de {limite_de_paciencia}.")

            # se esgotar os limites, encerra pra não piorar o arquivo salvo
            if contador_epocas_sem_melhoria >= limite_de_paciencia:
                print(f"Alerta de segurança: O modelo parou de aprender padrões novos. Encerrando sem concluir o processo inteiro na época {epoca_atual+1}.")
                break

    print("finalizado com sucesso, arquivo 'melhor_modelo.pth'.")

    print("\nTeste final")

    modelo_rede_neural.load_state_dict(torch.load("melhor_modelo.pth", map_location=dispositivo_processamento, weights_only=True))
    modelo_rede_neural.eval()

    acertos_teste = 0
    total_imagens_teste = 0

    # listas vazias para guardar o histórico do teste
    todas_as_previsoes = []
    todos_os_gabaritos = []
    todas_as_probabilidades_malignas = []

    with torch.no_grad():
        barra_progresso_teste = tqdm(carregador_lotes_teste, desc="Avaliando Teste Final", file=erro_original)
        for lote_imagens, lote_gabaritos_reais in barra_progresso_teste:
            lote_imagens = lote_imagens.to(dispositivo_processamento)
            lote_gabaritos_reais = lote_gabaritos_reais.to(dispositivo_processamento)

            previsoes_do_modelo = modelo_rede_neural(lote_imagens)
            # transforma os valores do modelo em probabilidades
            probabilidades = torch.softmax(previsoes_do_modelo, dim=1)

            # guarda a probabilidade de cada imagem ser maligna
            todas_as_probabilidades_malignas.extend(
                probabilidades[:, 1].cpu().numpy()
            )
            _, classe_escolhida = torch.max(previsoes_do_modelo, 1)

            total_imagens_teste += lote_gabaritos_reais.size(0)
            acertos_teste += (classe_escolhida == lote_gabaritos_reais).sum().item()

            # envia os resultados do lote atual para as listas, convertendo para CPU
            todas_as_previsoes.extend(classe_escolhida.cpu().numpy())
            todos_os_gabaritos.extend(lote_gabaritos_reais.cpu().numpy())

    acuracia_teste = (acertos_teste / total_imagens_teste) * 100
    print(f"\nResultado do Teste Final: O modelo acertou {acuracia_teste:.2f}% das imagens inéditas.")

    # gera a matriz e o relatório
    matriz = confusion_matrix(todos_os_gabaritos, todas_as_previsoes, labels=[0, 1])
    relatorio = classification_report(
        todos_os_gabaritos,
        todas_as_previsoes,
        labels=[0, 1],
        target_names=["Benigno (0)", "Maligno (1)"],
        zero_division=0
    )

    # calcula quantos benignos foram identificados corretamente
    verdadeiros_negativos = matriz[0, 0]

    # calcula quantos benignos foram classificados como malignos
    falsos_positivos = matriz[0, 1]

    # calcula a especificidade
    especificidade = (
    verdadeiros_negativos /
    (verdadeiros_negativos + falsos_positivos)
    )

    # sensibilidade (recall de maligno) e falsos negativos ---
    verdadeiros_positivos = matriz[1, 1]
    falsos_negativos = matriz[1, 0]  # malignos classificados como benignos

    sensibilidade = (
        verdadeiros_positivos /
        (verdadeiros_positivos + falsos_negativos)
    )

    # calcula a auc-roc usando as probabilidades de malignidade
    auc_roc = roc_auc_score(
    todos_os_gabaritos,
    todas_as_probabilidades_malignas
    )

    print(f"Sensibilidade: {sensibilidade * 100:.2f}%")
    print(f"Especificidade: {especificidade * 100:.2f}%")
    print(f"AUC-ROC: {auc_roc:.4f}")

    print("\nMatriz de confusão")
    print("Eixo vertical: Realidade | Eixo horizontal: Previsão da IA\n")
    print(matriz)
    print("\nRelatório clínico")
    print(relatorio)

    # gráfico visual colorido da matriz de confusão
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        matriz,
        annot=True,  # números dentro dos quadrados
        fmt="d",     # formata como números inteiros
        cmap="Blues",  # esquema de cores
        xticklabels=["Benigno (0)", "Maligno (1)"],
        yticklabels=["Benigno (0)", "Maligno (1)"]
    )

    plt.ylabel('Realidade (Gabarito)')
    plt.xlabel('Previsão da IA')
    plt.title('Matriz de confusão - Avaliação final (Melanoma)')

    plt.tight_layout()
    plt.savefig('grafico_matriz_confusao.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("\nGráfico visual salvo com sucesso como 'grafico_matriz_confusao.png'!")

    print(f"\nResultados da execução salvos em: {nome_arquivo_resultados}")

except Exception:
    # se der algum erro, guarda a mensagem no txt antes de encerrar
    traceback.print_exc()
    raise

finally:
    # volta a exibir as mensagens normalmente no terminal e fecha o arquivo txt
    sys.stdout = saida_original
    sys.stderr = erro_original
    arquivo_resultados.close()
