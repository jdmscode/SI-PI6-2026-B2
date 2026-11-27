"""Compara se os três modelos erram as mesmas imagens.

Não altera a API. Não houve boosting nem outro treino para forçar
diversidade: se as previsões forem quase iguais, o ensemble pouco muda
o resultado de um modelo só.

Os pesos não são comparáveis entre si. EfficientNet, ResNet e Swin têm
arquiteturas diferentes, então não existe um "cosseno dos parâmetros".
O script conta os parâmetros de cada um e compara o comportamento no teste:
concordância, kappa, correlação das probabilidades, sobreposição dos erros
e estatística Q (medida clássica de diversidade de ensemble).

    python comparar_modelos.py
    python comparar_modelos.py --teste C:\\caminho\\melanoma_cancer_dataset\\test

Como ler:
- Concordância perto de 100% e kappa perto de 1: decidem igual.
- Q perto de 1: acertam e erram juntos. Q perto de 0: erros independentes.
  Q negativo: erram em imagens diferentes (bom para ensemble).
- "Todos erraram" é o teto do que o ensemble não recupera.
- "Divergiram" é onde hard/soft podem mudar a classe.
"""

import argparse
import sys
from datetime import datetime
from itertools import combinations
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import cohen_kappa_score
from torchvision import datasets

sys.path.insert(0, str(Path(__file__).resolve().parent))
from modelos_avaliacao import MODELOS, carregar_modelo, contar_parametros, inferir

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


def estatistica_q(certo_a, certo_b):
    n11 = int(np.sum(certo_a & certo_b))
    n00 = int(np.sum(~certo_a & ~certo_b))
    n10 = int(np.sum(certo_a & ~certo_b))
    n01 = int(np.sum(~certo_a & certo_b))
    denominador = n11 * n00 + n01 * n10
    q = (n11 * n00 - n01 * n10) / denominador if denominador else float("nan")
    return q, n11, n00, n10, n01


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--teste", default=None)
    parser.add_argument("--pesos", default=str(RAIZ / "api" / "modelos"))
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()

    pasta_teste = achar_teste(args.teste)
    pasta_pesos = Path(args.pesos)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    dataset = datasets.ImageFolder(pasta_teste)
    if dataset.class_to_idx != {"benign": 0, "malignant": 1}:
        raise ValueError(f"Mapeamento inesperado: {dataset.class_to_idx}")

    agora = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    pasta_saida = Path(__file__).resolve().parent / f"comparacao_modelos_{agora}"
    pasta_saida.mkdir(parents=True, exist_ok=True)

    previsoes = {}
    prob_maligno = {}
    gabarito = None
    linhas = [
        f"Dispositivo: {device}",
        f"Teste: {pasta_teste}",
        f"Imagens: {len(dataset)}",
        "",
        "Parâmetros (não comparáveis entre arquiteturas; só o tamanho de cada rede)",
    ]

    for model_id, config in MODELOS.items():
        print(f"Inferindo {config['nome']}...")
        modelo = carregar_modelo(model_id, pasta_pesos, device)
        linhas.append(f"{config['nome']}: {contar_parametros(modelo):,} parâmetros")
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
    n = len(gabarito)
    certos = {i: previsoes[i] == gabarito for i in ids}

    todos_iguais = np.ones(n, dtype=bool)
    todos_certos = np.ones(n, dtype=bool)
    todos_errados = np.ones(n, dtype=bool)
    for i in ids:
        todos_iguais &= previsoes[i] == previsoes[ids[0]]
        todos_certos &= certos[i]
        todos_errados &= ~certos[i]

    algum_certo = np.zeros(n, dtype=bool)
    for i in ids:
        algum_certo |= certos[i]

    linhas += [
        "",
        "Visão dos três juntos",
        f"Mesma classe prevista: {todos_iguais.mean() * 100:.2f}% ({int(todos_iguais.sum())}/{n})",
        f"Os três acertaram: {todos_certos.mean() * 100:.2f}% ({int(todos_certos.sum())}/{n})",
        f"Os três erraram: {todos_errados.mean() * 100:.2f}% ({int(todos_errados.sum())}/{n})",
        f"Pelo menos um acertou: {algum_certo.mean() * 100:.2f}% ({int(algum_certo.sum())}/{n})",
        f"Divergiram (ensemble pode mudar o voto): {(~todos_iguais).mean() * 100:.2f}% ({int((~todos_iguais).sum())}/{n})",
        "",
        "Pares",
    ]

    for a, b in combinations(ids, 2):
        nome_a = MODELOS[a]["nome"]
        nome_b = MODELOS[b]["nome"]
        iguais = previsoes[a] == previsoes[b]
        kappa = cohen_kappa_score(previsoes[a], previsoes[b])
        if np.std(prob_maligno[a]) == 0 or np.std(prob_maligno[b]) == 0:
            correlacao = float("nan")
        else:
            correlacao = float(np.corrcoef(prob_maligno[a], prob_maligno[b])[0, 1])

        erros_a = ~certos[a]
        erros_b = ~certos[b]
        ambos_errados = erros_a & erros_b
        uniao_erros = erros_a | erros_b
        jaccard = (
            ambos_errados.sum() / uniao_erros.sum()
            if uniao_erros.any()
            else float("nan")
        )
        q, n11, n00, n10, n01 = estatistica_q(certos[a], certos[b])

        linhas += [
            f"\n{nome_a} x {nome_b}",
            f"Concordância de classe: {iguais.mean() * 100:.2f}%",
            f"Kappa: {kappa:.4f}",
            f"Correlação de P(maligno): {correlacao:.4f}",
            f"Jaccard dos erros: {jaccard:.4f}",
            f"Double-fault (os dois erram): {ambos_errados.mean() * 100:.2f}%",
            f"Q: {q:.4f}",
            f"Ambos certos: {n11} | ambos errados: {n00} | só {nome_a}: {n10} | só {nome_b}: {n01}",
        ]

    texto = "\n".join(linhas)
    print(texto)
    destino = pasta_saida / "comparacao.txt"
    destino.write_text(texto + "\n", encoding="utf-8")

    tabela = np.column_stack([
        gabarito,
        *[previsoes[i] for i in ids],
        *[prob_maligno[i] for i in ids],
    ])
    cabecalho_csv = ",".join(
        ["gabarito"]
        + [f"classe_{i}" for i in ids]
        + [f"p_maligno_{i}" for i in ids]
    )
    np.savetxt(
        pasta_saida / "previsoes_por_imagem.csv",
        tabela,
        delimiter=",",
        header=cabecalho_csv,
        comments="",
        fmt="%.6f",
    )
    print(f"\nResultados em: {pasta_saida}")


if __name__ == "__main__":
    main()
