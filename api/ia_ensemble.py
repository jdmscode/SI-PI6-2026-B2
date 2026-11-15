import os
from collections import Counter

import torch
import torchvision
from PIL import Image
from torch import nn
from torchvision import transforms

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

MODELS_DIR = os.environ.get("MODELS_DIR", "modelos")

IDX_PARA_CLASSE = {
    0: "benigno",
    1: "maligno",
}

IMAGENET_NORMALIZE = transforms.Normalize(
    mean=[0.485, 0.456, 0.406],
    std=[0.229, 0.224, 0.225],
)

TRANSFORM_300 = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    IMAGENET_NORMALIZE,
])

TRANSFORM_224 = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    IMAGENET_NORMALIZE,
])

MODEL_CONFIG = {
    "efficientnet_b3": {
        "nome_exibicao": "EfficientNet-B3",
        "arquivo": "melhor_modelo_efficientnetb3.pth",
        "transform": TRANSFORM_300,
    },
    "resnet50": {
        "nome_exibicao": "ResNet50",
        "arquivo": "melhor_modelo_resnet50.pth",
        "transform": TRANSFORM_300,
    },
    "swin_t": {
        "nome_exibicao": "Swin-T",
        "arquivo": "melhor_modelo_swin_t.pth",
        "transform": TRANSFORM_224,
    },
}


def definir_risco(classificacao: str, confianca: float) -> str:
    if classificacao == "maligno":
        if confianca >= 0.85:
            return "alto"
        if confianca >= 0.60:
            return "medio"
        return "baixo"

    if classificacao == "benigno":
        if confianca >= 0.85:
            return "baixo"
        if confianca >= 0.60:
            return "medio"
        return "indefinido"

    return "indefinido"


def _criar_efficientnet_b3() -> nn.Module:
    model = torchvision.models.efficientnet_b3(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.5),
        nn.Linear(in_features, 2),
    )
    return model


def _criar_resnet50() -> nn.Module:
    model = torchvision.models.resnet50(weights=None)
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(p=0.5),
        nn.Linear(in_features, 2),
    )
    return model


def _criar_swin_t() -> nn.Module:
    model = torchvision.models.swin_t(weights=None)
    in_features = model.head.in_features
    model.head = nn.Sequential(
        nn.Dropout(p=0.5),
        nn.Linear(in_features, 2),
    )
    return model


def _fabrica_modelo(model_id: str) -> nn.Module:
    if model_id == "efficientnet_b3":
        return _criar_efficientnet_b3()
    if model_id == "resnet50":
        return _criar_resnet50()
    if model_id == "swin_t":
        return _criar_swin_t()
    raise ValueError(f"Modelo desconhecido: {model_id}")


def _caminho_peso(arquivo: str) -> str:
    return os.path.join(MODELS_DIR, arquivo)


def carregar_modelos() -> dict[str, nn.Module]:
    modelos: dict[str, nn.Module] = {}
    for model_id, config in MODEL_CONFIG.items():
        caminho = _caminho_peso(config["arquivo"])
        if not os.path.isfile(caminho):
            raise FileNotFoundError(
                f"Peso não encontrado: {caminho}. "
                f"Coloque os arquivos .pth em api/{MODELS_DIR}/."
            )
        model = _fabrica_modelo(model_id)
        model.load_state_dict(
            torch.load(caminho, map_location=device, weights_only=True)
        )
        model.to(device)
        model.eval()
        modelos[model_id] = model
    return modelos


MODELOS = carregar_modelos()


def _prever_com_modelo(
    model_id: str,
    imagem: Image.Image,
) -> dict:
    config = MODEL_CONFIG[model_id]
    tensor = config["transform"](imagem).unsqueeze(0).to(device)
    model = MODELOS[model_id]

    with torch.no_grad():
        saida = model(tensor)
        probabilidades = torch.softmax(saida, dim=1)[0]

    prob_benigno = probabilidades[0].item()
    prob_maligno = probabilidades[1].item()
    indice = 0 if prob_benigno >= prob_maligno else 1
    confianca = probabilidades[indice].item()
    classificacao = IDX_PARA_CLASSE[indice]

    return {
        "id": model_id,
        "nome_exibicao": config["nome_exibicao"],
        "classificacao": classificacao,
        "confianca": round(confianca, 4),
        "probabilidades": {
            "benigno": round(prob_benigno, 4),
            "maligno": round(prob_maligno, 4),
        },
    }


def _ensemble_hard(previsoes: list[dict]) -> dict:
    votos = Counter(p["classificacao"] for p in previsoes)
    classificacao = votos.most_common(1)[0][0]
    confianca = round(votos[classificacao] / len(previsoes), 4)
    risco = definir_risco(classificacao, confianca)
    return {
        "classificacao": classificacao,
        "confianca": confianca,
        "risco": risco,
        "votos": {
            "benigno": votos.get("benigno", 0),
            "maligno": votos.get("maligno", 0),
        },
    }


def _ensemble_soft(previsoes: list[dict]) -> dict:
    n = len(previsoes)
    prob_benigno = sum(p["probabilidades"]["benigno"] for p in previsoes) / n
    prob_maligno = sum(p["probabilidades"]["maligno"] for p in previsoes) / n

    if prob_benigno >= prob_maligno:
        classificacao = "benigno"
        confianca = prob_benigno
    else:
        classificacao = "maligno"
        confianca = prob_maligno

    confianca = round(confianca, 4)
    risco = definir_risco(classificacao, confianca)

    return {
        "classificacao": classificacao,
        "confianca": confianca,
        "risco": risco,
        "probabilidades": {
            "benigno": round(prob_benigno, 4),
            "maligno": round(prob_maligno, 4),
        },
    }


def avaliar_imagem(caminho_imagem: str) -> dict:
    imagem = Image.open(caminho_imagem).convert("RGB")

    previsoes_por_id = {}
    for model_id in MODEL_CONFIG:
        previsoes_por_id[model_id] = _prever_com_modelo(model_id, imagem)

    lista_previsoes = list(previsoes_por_id.values())

    return {
        "modelos": previsoes_por_id,
        "ensemble": {
            "hard": _ensemble_hard(lista_previsoes),
            "soft": _ensemble_soft(lista_previsoes),
        },
    }


def resposta_hard_voting(resultado: dict) -> dict:
    return {
        "modelos": resultado["modelos"],
        "ensemble": {"hard": resultado["ensemble"]["hard"]},
    }


def resposta_soft_voting(resultado: dict) -> dict:
    return {
        "modelos": resultado["modelos"],
        "ensemble": {"soft": resultado["ensemble"]["soft"]},
    }
