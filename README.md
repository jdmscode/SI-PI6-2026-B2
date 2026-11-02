# Melanoma Mapper

Projeto acadêmico de visão computacional para classificação de imagens dermatológicas em duas categorias: **benigna** e **maligna**. O modelo utiliza *transfer learning* com EfficientNet-B3 e PyTorch.

> **Aviso importante:** este projeto é experimental e educacional. Não é um dispositivo médico e não deve ser utilizado para diagnosticar, descartar ou orientar o tratamento de qualquer condição de saúde. Uma classificação incorreta pode ocorrer; decisões clínicas devem ser tomadas por profissionais qualificados.

## Objetivo

Investigar o uso de redes neurais convolucionais para classificar imagens dermatológicas e avaliar o desempenho com métricas como acurácia, precisão, recall, especificidade, F1-score e AUC-ROC.

## Tecnologias

- Python
- PyTorch e Torchvision
- EfficientNet-B3 pré-treinada
- scikit-learn
- NumPy
- Matplotlib e Seaborn
- tqdm

## Como funciona

1. Carrega as imagens e seus rótulos a partir das pastas do dataset.
2. Redimensiona as imagens para `300 × 300` pixels e aplica normalização compatível com os pesos pré-treinados.
3. Divide a pasta `train` em conjuntos de treinamento e validação, usando uma divisão de 80%/20%.
4. Utiliza EfficientNet-B3 pré-treinada. Na configuração avaliada, a base convolucional fica congelada e a camada classificadora é adaptada para duas classes.
5. Treina o classificador por até 20 épocas, com *early stopping* baseado na perda de validação e paciência de 3 épocas.
6. Salva os pesos do melhor modelo em `melhor_modelo.pth`.
7. Avalia o modelo no conjunto `test` e gera métricas, matriz de confusão, gráfico e arquivo de log.

## Estrutura esperada dos dados

O carregamento usa `torchvision.datasets.ImageFolder`, portanto cada classe deve estar em sua própria subpasta:

```text
melanoma_cancer_dataset/
├── train/
│   ├── benign/
│   └── malignant/
└── test/
    ├── benign/
    └── malignant/
```

A organização acima representa a estrutura esperada pelo código. O dataset não é incluído neste repositório; obtenha-o de uma fonte autorizada e confira seus termos de uso antes de utilizá-lo.

O código espera encontrar o dataset em `../melanoma_cancer_dataset/`, relativo ao diretório de execução do script. Se a sua organização de pastas for diferente, ajuste os caminhos no código.

As classes devem ser mapeadas de forma consistente entre treino e teste. Com os nomes `benign` e `malignant`, o `ImageFolder` normalmente usa:

```python
{'benign': 0, 'malignant': 1}
```

## Instalação

Recomenda-se utilizar um ambiente virtual.

### Windows (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install torch torchvision numpy matplotlib seaborn scikit-learn tqdm
```

### Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install torch torchvision numpy matplotlib seaborn scikit-learn tqdm
```

Para executar em GPU NVIDIA, instale a versão do PyTorch compatível com a versão do CUDA e com os drivers do seu computador. Consulte o seletor oficial de instalação: https://pytorch.org/get-started/locally/

## Executar o treinamento e a avaliação

Salve o script Python do projeto (por exemplo, `treinamento.py`), confirme os caminhos do dataset e execute-o a partir do diretório esperado pelo código:

```bash
python treinamento.py
```

O script detecta automaticamente se o CUDA está disponível e utiliza GPU ou CPU conforme o ambiente.

Durante a execução, o código registra as métricas por época. Ao final, os arquivos gerados incluem:

- `melhor_modelo.pth` — pesos da melhor versão do modelo, conforme a perda de validação.
- `grafico_matriz_confusao.png` — visualização da matriz de confusão.
- `resultado_melanoma_AAAA-MM-DD_HH-MM-SS.txt` — log da execução, com data e hora.

Os arquivos são gravados no diretório de execução. Não versione o dataset, ambientes virtuais, logs pessoais ou arquivos de pesos grandes sem avaliar antes o tamanho, as licenças e as regras do repositório.


## Autoria

Projeto acadêmico desenvolvido para fins de estudo e pesquisa em visão computacional e classificação de imagens dermatológicas.
