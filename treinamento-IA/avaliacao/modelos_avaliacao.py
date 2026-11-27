"""Carrega os três checkpoints do mesmo jeito que a API e o treino.

Não faz parte do serviço. Os scripts desta pasta importam daqui para
não repetir a arquitetura (Dropout 0.5 + Linear de 2 classes).
"""

from pathlib import Path

import torch
import torchvision
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

IMAGENET = transforms.Normalize(
    mean=[0.485, 0.456, 0.406],
    std=[0.229, 0.224, 0.225],
)

TRANSFORM_300 = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    IMAGENET,
])

TRANSFORM_224 = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    IMAGENET,
])

MODELOS = {
    "efficientnet_b3": {
        "nome": "EfficientNet-B3",
        "arquivo": "melhor_modelo_efficientnetb3.pth",
        "transform": TRANSFORM_300,
    },
    "resnet50": {
        "nome": "ResNet50",
        "arquivo": "melhor_modelo_resnet50.pth",
        "transform": TRANSFORM_300,
    },
    "swin_t": {
        "nome": "Swin-T",
        "arquivo": "melhor_modelo_swin_t.pth",
        "transform": TRANSFORM_224,
    },
}


def criar_modelo(model_id: str) -> nn.Module:
    if model_id == "efficientnet_b3":
        model = torchvision.models.efficientnet_b3(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(nn.Dropout(p=0.5), nn.Linear(in_features, 2))
        return model

    if model_id == "resnet50":
        model = torchvision.models.resnet50(weights=None)
        in_features = model.fc.in_features
        model.fc = nn.Sequential(nn.Dropout(p=0.5), nn.Linear(in_features, 2))
        return model

    if model_id == "swin_t":
        model = torchvision.models.swin_t(weights=None)
        in_features = model.head.in_features
        model.head = nn.Sequential(nn.Dropout(p=0.5), nn.Linear(in_features, 2))
        return model

    raise ValueError(model_id)


def carregar_modelo(model_id: str, pasta_pesos: Path, device: torch.device) -> nn.Module:
    caminho = pasta_pesos / MODELOS[model_id]["arquivo"]
    if not caminho.is_file():
        raise FileNotFoundError(f"Peso não encontrado: {caminho}")

    model = criar_modelo(model_id)
    model.load_state_dict(torch.load(caminho, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    return model


def contar_parametros(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


class _Amostras(Dataset):
    def __init__(self, samples, transform):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        caminho, rotulo = self.samples[index]
        imagem = Image.open(caminho).convert("RGB")
        return self.transform(imagem), rotulo


def inferir(model, samples, transform, device, batch_size=16):
    """Devolve rótulos, classe prevista e probabilidade de maligno, na ordem do dataset."""
    loader = DataLoader(
        _Amostras(samples, transform),
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
    )

    rotulos = []
    classes = []
    prob_maligno = []

    with torch.inference_mode():
        for lote, gabarito in loader:
            lote = lote.to(device)
            saida = model(lote)
            probabilidades = torch.softmax(saida, dim=1)
            classe = torch.argmax(probabilidades, dim=1)

            rotulos.extend(gabarito.numpy().tolist())
            classes.extend(classe.cpu().numpy().tolist())
            prob_maligno.extend(probabilidades[:, 1].cpu().numpy().tolist())

    return rotulos, classes, prob_maligno
