"""Avalia o ensemble no mesmo conjunto de teste dos treinos.

Não altera a API. Rode quando o dataset de teste estiver disponível:

    python avaliar_ensemble.py
    python avaliar_ensemble.py --teste C:\\caminho\\melanoma_cancer_dataset\\test

Métricas, iguais às dos modelos individuais:
acurácia, sensibilidade (recall de maligno), especificidade,
AUC-ROC, matriz de confusão e classification_report.

Hard voting: classe por maioria. O escore da AUC é a fração de
modelos que votaram maligno (0, 1/3, 2/3 ou 1).
Soft voting: média das probabilidades. A AUC usa essa média de maligno.
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import torch
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from torchvision import datasets

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelos_avaliacao import MODELOS, carregar_modelo, inferir

RAIZ = Path(__file__).resolve().parents[2]


def achar_teste(informado: str | None) -> Path:
    if informado:
        caminho = Path(informado)
        if not caminho.is_dir():
            raise FileNotFoundError(caminho)
        return caminho

    candidatos = [
        RAIZ / "melanoma_cancer_dataset" / "test",
        RAIZ.parent / "melanoma_cancer_dataset" / "test",
    ]
    for candidato in candidatos:
        if candidato.is_dir():
            return candidato

    raise FileNotFoundError(
        "Conjunto de teste não encontrado. Passe --teste com a pasta "
        "que contém benign/ e malignant/."
    )


def calcular(gabarito, previsto, escore_maligno):
    matriz = confusion_matrix(gabarito, previsto, labels=[0, 1])
    tn, fp, fn, tp = matriz.ravel()
    total = int(matriz.sum())
    acuracia = (tn + tp) / total if total else float("nan")
    sensibilidade = tp / (tp + fn) if (tp + fn) else float("nan")
    especificidade = tn / (tn + fp) if (tn + fp) else float("nan")
    auc = (
        roc_auc_score(gabarito, escore_maligno)
        if len(np.unique(gabarito)) == 2
        else float("nan")
    )
    relatorio = classification_report(
        gabarito,
        previsto,
        labels=[0, 1],
        target_names=["benign (0)", "malignant (1)"],
        zero_division=0,
    )
    return {
        "matriz": matriz,
        "acuracia": acuracia,
        "sensibilidade": sensibilidade,
        "especificidade": especificidade,
        "auc": auc,
        "relatorio": relatorio,
    }


def escrever_bloco(saida, titulo, metricas):
    linhas = [
        f"\n{titulo}",
        f"Acurácia: {metricas['acuracia'] * 100:.2f}%",
        f"Sensibilidade: {metricas['sensibilidade'] * 100:.2f}%",
        f"Especificidade: {metricas['especificidade'] * 100:.2f}%",
        f"AUC-ROC: {metricas['auc']:.4f}",
        "\nMatriz de confusão",
        "Eixo vertical: Realidade | Eixo horizontal: Previsão\n",
        str(metricas["matriz"]),
        "\nRelatório de classificação",
        metricas["relatorio"],
    ]
    texto = "\n".join(linhas)
    print(texto)
    saida.write(texto + "\n")


def salvar_matriz(matriz, titulo, caminho: Path):
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        matriz,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["benign (0)", "malignant (1)"],
        yticklabels=["benign (0)", "malignant (1)"],
    )
    plt.ylabel("Realidade (Gabarito)")
    plt.xlabel("Previsão")
    plt.title(titulo)
    plt.tight_layout()
    plt.savefig(caminho, dpi=300, bbox_inches="tight")
    plt.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--teste", default=None, help="Pasta test/ do dataset")
    parser.add_argument(
        "--pesos",
        default=str(RAIZ / "api" / "modelos"),
        help="Pasta com os três .pth",
    )
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()

    pasta_teste = achar_teste(args.teste)
    pasta_pesos = Path(args.pesos)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    dataset = datasets.ImageFolder(pasta_teste)
    if dataset.class_to_idx != {"benign": 0, "malignant": 1}:
        raise ValueError(f"Mapeamento inesperado: {dataset.class_to_idx}")

    agora = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    pasta_saida = Path(__file__).resolve().parent / f"resultado_ensemble_{agora}"
    pasta_saida.mkdir(parents=True, exist_ok=True)
    arquivo = open(pasta_saida / "metricas.txt", "w", encoding="utf-8")

    cabecalho = (
        f"Dispositivo: {device}\n"
        f"Teste: {pasta_teste}\n"
        f"Imagens: {len(dataset)}\n"
        f"Classes: {dataset.class_to_idx}\n"
    )
    print(cabecalho)
    arquivo.write(cabecalho + "\n")

    previsoes = {}
    prob_maligno = {}
    gabarito = None

    for model_id, config in MODELOS.items():
        print(f"Inferindo {config['nome']}...")
        modelo = carregar_modelo(model_id, pasta_pesos, device)
        gabarito, classes, probabilidades = inferir(
            modelo, dataset.samples, config["transform"], device, args.batch
        )
        previsoes[model_id] = np.array(classes)
        prob_maligno[model_id] = np.array(probabilidades)
        del modelo
        if device.type == "cuda":
            torch.cuda.empty_cache()

    gabarito = np.array(gabarito)
    ids = list(MODELOS)

    for model_id in ids:
        metricas = calcular(gabarito, previsoes[model_id], prob_maligno[model_id])
        titulo = f"Modelo individual — {MODELOS[model_id]['nome']}"
        escrever_bloco(arquivo, titulo, metricas)
        salvar_matriz(
            metricas["matriz"],
            titulo,
            pasta_saida / f"matriz_{model_id}.png",
        )

    votos_maligno = np.mean([previsoes[i] for i in ids], axis=0)
    hard = (votos_maligno >= 0.5).astype(int)
    metricas_hard = calcular(gabarito, hard, votos_maligno)
    escrever_bloco(arquivo, "Ensemble — hard voting (maioria)", metricas_hard)
    salvar_matriz(
        metricas_hard["matriz"],
        "Ensemble hard voting",
        pasta_saida / "matriz_hard.png",
    )

    media_maligno = np.mean([prob_maligno[i] for i in ids], axis=0)
    media_benigno = 1.0 - media_maligno
    soft = (media_maligno > media_benigno).astype(int)
    metricas_soft = calcular(gabarito, soft, media_maligno)
    escrever_bloco(arquivo, "Ensemble — soft voting (média das probabilidades)", metricas_soft)
    salvar_matriz(
        metricas_soft["matriz"],
        "Ensemble soft voting",
        pasta_saida / "matriz_soft.png",
    )

    arquivo.close()
    print(f"\nResultados em: {pasta_saida}")


if __name__ == "__main__":
    main()
