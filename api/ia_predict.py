import torch
import torchvision
from torchvision import transforms
from torch import nn
from PIL import Image

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

idx_para_classe = {
    0: "benigno",
    1: "maligno" 
}

transform = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def carregar_modelo():
    model = torchvision.models.efficientnet_b3(weights="DEFAULT")
    
    # recriando a carcaça exatamente como foi treinada
    model.classifier[0] = nn.Dropout(p=0.5, inplace=True)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, 2)

    # lendo o arquivo que geramos no último treino
    model.load_state_dict(
        torch.load("melhor_modelo.pth", map_location=device, weights_only=True)
    )

    model.to(device)
    model.eval() # desliga o dropout para a previsão

    return model

model = carregar_modelo()

def definir_risco(classificacao, confianca):
    if classificacao == "maligno":
        if confianca >= 0.85:
            return "alto"
        elif confianca >= 0.60:
            return "medio"
        return "baixo"

    if classificacao == "benigno":
        if confianca >= 0.85:
            return "baixo"
        elif confianca >= 0.60:
            return "medio"
        return "indefinido"

    return "indefinido"

def prever_lesao(caminho_imagem):
    imagem = Image.open(caminho_imagem).convert("RGB")
    imagem_tensor = transform(imagem).unsqueeze(0).to(device)

    with torch.no_grad():
        saida = model(imagem_tensor)
            
        probabilidades = torch.softmax(saida, dim=1)
        confianca, indice_previsto = torch.max(probabilidades, dim=1)

    indice_previsto = indice_previsto.item()
    confianca = confianca.item()

    classificacao = idx_para_classe[indice_previsto]
    risco = definir_risco(classificacao, confianca)

    return {
        "classificacao": classificacao,
        "risco": risco,
        "confianca": round(confianca, 4)
    }