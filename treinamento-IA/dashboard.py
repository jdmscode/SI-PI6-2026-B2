
import re
from pathlib import Path

import streamlit as st
import pandas as pd
from PIL import Image


# ==========================================
# CONFIGURAÇÕES
# ==========================================

st.set_page_config(
    page_title="Dashboard - Detecção de Melanoma",
    page_icon="🔬",
    layout="wide"
)

PASTA_BASE = Path(__file__).resolve().parent

MODELOS = {
    "Swin Transformer Tiny": {
        "pasta": "Swin",
        "matriz": "grafico_matriz_confusao_swin_t.png",
        "perdas": "grafico_perdas_swin_t.png",
        "prefixo": "resultado_melanoma_swin_t_"
    },
    "ResNet50": {
        "pasta": "ResNet50",
        "matriz": "grafico_matriz_confusao_resnet50.png",
        "perdas": "grafico_perdas_resnet50.png",
        "prefixo": "resultado_melanoma_resnet50_"
    },
    "EfficientNetB3": {
        "pasta": "EfficientNetB3",
        "matriz": "grafico_matriz_confusao_efficientnetb3.png",
        "perdas": "grafico_perdas_efficientnetb3.png",
        "prefixo": "resultado_melanoma_efficientnetb3_"
    }
}


# ==========================================
# LEITURA DOS RESULTADOS
# ==========================================

def obter_arquivo_resultados(pasta, prefixo):

    arquivos = list(pasta.glob(f"{prefixo}*.txt"))

    if not arquivos:
        return None

    return max(arquivos, key=lambda arquivo: arquivo.stat().st_mtime)


def extrair_valor(texto, padrao):

    resultado = re.search(
        padrao,
        texto,
        re.IGNORECASE
    )

    if resultado:
        return float(resultado.group(1).replace(",", "."))

    return None


def extrair_relatorio(texto):

    resultados = []

    padrao = (
        r"^\s*(benign|malignant)\s+\(\d+\)\s+"
        r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s*$"
    )

    for linha in texto.splitlines():

        resultado = re.search(padrao, linha)

        if resultado:

            resultados.append({
                "Classe": resultado.group(1),
                "Precision": float(resultado.group(2)),
                "Recall": float(resultado.group(3)),
                "F1-score": float(resultado.group(4)),
                "Support": int(resultado.group(5))
            })

    if resultados:
        return pd.DataFrame(resultados)

    return None


def carregar_modelo(nome, configuracao):

    pasta = PASTA_BASE / configuracao["pasta"]

    arquivo_txt = obter_arquivo_resultados(
        pasta,
        configuracao["prefixo"]
    )

    if arquivo_txt is None:
        return None

    texto = arquivo_txt.read_text(encoding="utf-8")

    dados = {
        "nome": nome,
        "arquivo": arquivo_txt.name,
        "texto": texto,
        "acuracia": extrair_valor(
            texto,
            r"Resultado do Teste Final:\s*([\d.,]+)"
        ),
        "sensibilidade": extrair_valor(
            texto,
            r"Sensibilidade:\s*([\d.,]+)"
        ),
        "especificidade": extrair_valor(
            texto,
            r"Especificidade:\s*([\d.,]+)"
        ),
        "auc": extrair_valor(
            texto,
            r"AUC-ROC:\s*([\d.,]+)"
        ),
        "relatorio": extrair_relatorio(texto),
        "matriz": pasta / configuracao["matriz"],
        "perdas": pasta / configuracao["perdas"]
    }

    return dados


# ==========================================
# CARREGAMENTO DOS MODELOS
# ==========================================

resultados = {}

for nome, configuracao in MODELOS.items():

    dados = carregar_modelo(nome, configuracao)

    if dados is not None:
        resultados[nome] = dados


# ==========================================
# CABEÇALHO
# ==========================================

st.title("🔬 Dashboard - Detecção de Melanoma")

st.markdown(
    """
    ### Análise comparativa de modelos de inteligência artificial

    Avaliação de redes neurais convolucionais e Vision Transformers
    para classificação de imagens dermatológicas entre lesões
    benignas e malignas.
    """
)

st.divider()


if not resultados:

    st.error("Nenhum arquivo de resultados foi encontrado.")

    st.stop()


# ==========================================
# MENU LATERAL
# ==========================================

st.sidebar.title("Navegação")

pagina = st.sidebar.radio(
    "Selecione uma seção:",
    [
        "Visão Geral",
        "Comparação dos Modelos",
        "Matrizes de Confusão",
        "Relatórios de Classificação",
        "Curvas de Aprendizado",
        "Arquivos de Resultados"
    ]
)


# ==========================================
# VISÃO GERAL
# ==========================================

if pagina == "Visão Geral":

    st.header("Visão Geral dos Resultados")

    colunas = st.columns(len(resultados))

    for coluna, (nome, dados) in zip(colunas, resultados.items()):

        with coluna:

            st.metric(
                label=f"Acurácia - {nome}",
                value=(
                    f"{dados['acuracia']:.2f}%"
                    if dados["acuracia"] is not None
                    else "Não encontrada"
                )
            )

            st.caption(
                f"AUC-ROC: {dados['auc']:.4f}"
                if dados["auc"] is not None
                else "AUC não encontrada"
            )

    st.divider()

    st.subheader("Indicadores de desempenho")

    for nome, dados in resultados.items():

        st.markdown(f"#### {nome}")

        c1, c2, c3 = st.columns(3)

        c1.metric(
            "Sensibilidade",
            f"{dados['sensibilidade']:.2f}%"
            if dados["sensibilidade"] is not None else "N/D"
        )

        c2.metric(
            "Especificidade",
            f"{dados['especificidade']:.2f}%"
            if dados["especificidade"] is not None else "N/D"
        )

        c3.metric(
            "AUC-ROC",
            f"{dados['auc']:.4f}"
            if dados["auc"] is not None else "N/D"
        )


# ==========================================
# COMPARAÇÃO DOS MODELOS
# ==========================================

elif pagina == "Comparação dos Modelos":

    st.header("Comparação de Desempenho")

    tabela = []

    for nome, dados in resultados.items():

        tabela.append({
            "Modelo": nome,
            "Acurácia (%)": dados["acuracia"],
            "Sensibilidade (%)": dados["sensibilidade"],
            "Especificidade (%)": dados["especificidade"],
            "AUC-ROC": dados["auc"]
        })

    df = pd.DataFrame(tabela)

    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True
    )

    st.subheader("Comparação gráfica")

    metricas = [
        "Acurácia (%)",
        "Sensibilidade (%)",
        "Especificidade (%)"
    ]

    df_grafico = df.set_index("Modelo")[metricas]

    st.bar_chart(df_grafico)

    st.subheader("Comparação da AUC-ROC")

    df_auc = df.set_index("Modelo")[["AUC-ROC"]]

    st.bar_chart(df_auc)


# ==========================================
# MATRIZES DE CONFUSÃO
# ==========================================

elif pagina == "Matrizes de Confusão":

    st.header("Matrizes de Confusão")

    st.markdown(
        """
        As matrizes apresentam a relação entre as classificações
        reais e as previsões realizadas pelos modelos.
        """
    )

    st.info(
        "Eixo vertical: classe real | "
        "Eixo horizontal: previsão da IA."
    )

    for nome, dados in resultados.items():

        st.subheader(nome)

        if dados["matriz"].exists():

            imagem = Image.open(dados["matriz"])

            st.image(
                imagem,
                caption=f"Matriz de confusão - {nome}",
                use_container_width=True
            )

        else:

            st.warning("Imagem da matriz de confusão não encontrada.")

        st.divider()


# ==========================================
# RELATÓRIOS DE CLASSIFICAÇÃO
# ==========================================

elif pagina == "Relatórios de Classificação":

    st.header("Relatórios de Classificação")

    for nome, dados in resultados.items():

        st.subheader(nome)

        if dados["relatorio"] is not None:

            st.dataframe(
                dados["relatorio"],
                use_container_width=True,
                hide_index=True
            )

        else:

            st.warning(
                "Relatório de classificação não encontrado no arquivo."
            )

        st.divider()


# ==========================================
# CURVAS DE APRENDIZADO
# ==========================================

elif pagina == "Curvas de Aprendizado":

    st.header("Curvas de Aprendizado")

    st.markdown(
        """
        As curvas apresentam a evolução do erro (Loss)
        durante as etapas de treinamento e validação.
        """
    )

    for nome, dados in resultados.items():

        st.subheader(nome)

        if dados["perdas"].exists():

            imagem = Image.open(dados["perdas"])

            st.image(
                imagem,
                caption=f"Curva de aprendizado - {nome}",
                use_container_width=True
            )

        else:

            st.warning("Gráfico de perdas não encontrado.")

        st.divider()


# ==========================================
# ARQUIVOS DE RESULTADOS
# ==========================================

elif pagina == "Arquivos de Resultados":

    st.header("Arquivos de Resultados")

    for nome, dados in resultados.items():

        with st.expander(f"Resultados completos - {nome}"):

            st.caption(
                f"Arquivo utilizado: {dados['arquivo']}"
            )

            st.text(dados["texto"])


# ==========================================
# RODAPÉ
# ==========================================

st.sidebar.divider()

st.sidebar.caption(
    "Projeto de Inteligência Artificial - "
    "Classificação de Lesões Dermatológicas"
)
