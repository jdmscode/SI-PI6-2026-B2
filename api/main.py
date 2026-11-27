from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from database import engine, get_db, Base
from db_models import Medico, Paciente, Lesao
import bcrypt
import os
import shutil
from ia_ensemble import (
    avaliar_imagem,
    resposta_hard_voting,
    resposta_soft_voting,
)
import uuid
from fastapi.staticfiles import StaticFiles
from typing import Dict

SECRET_KEY = "sua_chave_secreta_super_segura" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

Base.metadata.create_all(bind=engine)


def _ensure_resultado_ia_column():
    insp = inspect(engine)
    if "lesoes" not in insp.get_table_names():
        return
    colunas = {c["name"] for c in insp.get_columns("lesoes")}
    if "resultado_ia" not in colunas:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE lesoes ADD COLUMN resultado_ia JSON NULL"))
            conn.commit()


_ensure_resultado_ia_column()

app = FastAPI(title="DermaScan AI API")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_medico_id(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        medico_id: str = payload.get("sub")
        if medico_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return int(medico_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado ou inválido")


class RegisterRequest(BaseModel):
    nome: str
    crm: str
    estado: str
    senha: str

class LoginRequest(BaseModel):
    crm: str
    estado: str
    senha: str

class PacienteCreate(BaseModel):
    nome: str
    idade: int
    cpf: str

class LaudoLesaoRequest(BaseModel):
    parecer_medico: str
    criterios_abcde: Dict[str, bool]
    veredito_medico: str | None = None


def _salvar_imagem_temporaria(imagem: UploadFile) -> str:
    extensao = os.path.splitext(imagem.filename or "")[1] or ".jpg"
    nome_arquivo = f"{uuid.uuid4()}{extensao}"
    caminho = os.path.join(UPLOAD_DIR, nome_arquivo)
    with open(caminho, "wb") as buffer:
        shutil.copyfileobj(imagem.file, buffer)
    return caminho


def _resposta_lesao(lesao: Lesao, resultado_ia: dict | None = None) -> dict:
    payload = {
        "id": lesao.id,
        "paciente_id": lesao.paciente_id,
        "data": lesao.data,
        "localizacao": lesao.localizacao,
        "descricao": lesao.descricao,
        "posicao": {
            "x": lesao.posicao_x,
            "y": lesao.posicao_y,
            "z": lesao.posicao_z,
        },
        "imagem_path": lesao.imagem_path,
        "classificacao": lesao.classificacao,
        "risco": lesao.risco,
        "confianca": lesao.confianca,
        "parecer_medico": lesao.parecer_medico,
        "criterios_abcde": lesao.criterios_abcde,
        "veredito_medico": lesao.veredito_medico,
        "resultado_ia": lesao.resultado_ia if resultado_ia is None else resultado_ia,
    }
    return payload


@app.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    medico_existente = db.query(Medico).filter(Medico.crm == request.crm, Medico.estado == request.estado).first()
    if medico_existente:
        raise HTTPException(status_code=400, detail="CRM já cadastrado.")
    
    senha_hash = bcrypt.hashpw(request.senha.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    novo_medico = Medico(nome=request.nome, crm=request.crm, estado=request.estado, senha=senha_hash)
    db.add(novo_medico)
    db.commit()
    return {"message": "Médico cadastrado com sucesso!"}

@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    medico = db.query(Medico).filter(Medico.crm == request.crm, Medico.estado == request.estado).first()
    
    if not medico or not bcrypt.checkpw(request.senha.encode('utf-8'), medico.senha.encode('utf-8')):
        raise HTTPException(status_code=401, detail="CRM ou senha incorretos.")

    
    access_token = create_access_token(data={"sub": str(medico.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "medico_nome": medico.nome,
        "medico_id": medico.id
    }

@app.get("/pacientes")
def listar_pacientes(db: Session = Depends(get_db), current_medico_id: int = Depends(get_current_medico_id)):
   
    return db.query(Paciente).filter(Paciente.medico_id == current_medico_id).all()

@app.post("/pacientes")
def criar_paciente(request: PacienteCreate, db: Session = Depends(get_db), current_medico_id: int = Depends(get_current_medico_id)):
    novo_paciente = Paciente(
        nome=request.nome,
        idade=request.idade,
        cpf=request.cpf,
        medico_id=current_medico_id, 
        ultima_consulta=datetime.now().strftime("%d/%m/%Y"),
        lesoes=0,
        risco="BAIXO RISCO"
    )
    db.add(novo_paciente)
    db.commit()
    return {"message": "Paciente cadastrado com sucesso!"}


@app.get("/pacientes/{paciente_id}")
def obter_detalhes_paciente(
    paciente_id: int, 
    db: Session = Depends(get_db), 
    current_medico_id: int = Depends(get_current_medico_id)
):
  
    paciente = db.query(Paciente).filter(
        Paciente.id == paciente_id, 
        Paciente.medico_id == current_medico_id
    ).first()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    lesoes = db.query(Lesao).filter(Lesao.paciente_id == paciente_id).all()

    return {
        "paciente": paciente,
        "lesoes": lesoes
    }

@app.get("/me")
def obter_perfil_medico(db: Session = Depends(get_db), current_medico_id: int = Depends(get_current_medico_id)):
    medico = db.query(Medico).filter(Medico.id == current_medico_id).first()
    return {"nome": medico.nome, "crm": medico.crm, "estado": medico.estado}


@app.post("/ia/avaliar/hard-voting")
async def avaliar_imagem_hard_voting(imagem: UploadFile = File(...)):
    caminho = _salvar_imagem_temporaria(imagem)
    try:
        resultado = avaliar_imagem(caminho)
        return resposta_hard_voting(resultado)
    finally:
        if os.path.isfile(caminho):
            os.remove(caminho)


@app.post("/ia/avaliar/soft-voting")
async def avaliar_imagem_soft_voting(imagem: UploadFile = File(...)):
    caminho = _salvar_imagem_temporaria(imagem)
    try:
        resultado = avaliar_imagem(caminho)
        return resposta_soft_voting(resultado)
    finally:
        if os.path.isfile(caminho):
            os.remove(caminho)


@app.post("/lesoes/analisar")
async def criar_lesao_com_ia(
    paciente_id: int = Form(...),
    data: str = Form(...),
    descricao: str = Form(...),
    localizacao: str = Form(...),
    posicao_x: float = Form(...),
    posicao_y: float = Form(...),
    posicao_z: float = Form(...),
    imagem: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    paciente = db.query(Paciente).filter(Paciente.id == paciente_id).first()

    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    caminho_imagem = _salvar_imagem_temporaria(imagem)

    resultado_ia = avaliar_imagem(caminho_imagem)
    consolidado_soft = resultado_ia["ensemble"]["soft"]

    nova_lesao = Lesao(
        data=data,
        localizacao=localizacao,
        descricao=descricao,
        posicao_x=posicao_x,
        posicao_y=posicao_y,
        posicao_z=posicao_z,
        imagem_path=caminho_imagem,
        classificacao=consolidado_soft["classificacao"],
        risco=consolidado_soft["risco"],
        confianca=str(consolidado_soft["confianca"]),
        paciente_id=paciente_id,
        resultado_ia=resultado_ia,
    )

    db.add(nova_lesao)
    db.commit()
    db.refresh(nova_lesao)
    paciente.lesoes = db.query(Lesao).filter(Lesao.paciente_id == paciente_id).count()
    paciente.risco = "ALTO RISCO" if consolidado_soft["risco"] == "alto" else "BAIXO RISCO"
    db.commit()

    return _resposta_lesao(nova_lesao)

@app.get("/lesoes")
def listar_lesoes(db: Session = Depends(get_db)):
    lesoes = db.query(Lesao).all()
    return lesoes

@app.get("/pacientes/{paciente_id}/lesoes")
def listar_lesoes_por_paciente(paciente_id: int, db: Session = Depends(get_db)):
    lesoes = db.query(Lesao).filter(Lesao.paciente_id == paciente_id).all()
    return lesoes

@app.get("/lesoes/{lesao_id}")
def buscar_lesao(lesao_id: int, db: Session = Depends(get_db)):
    lesao = db.query(Lesao).filter(Lesao.id == lesao_id).first()

    if not lesao:
        raise HTTPException(status_code=404, detail="Lesão não encontrada")

    return _resposta_lesao(lesao)

@app.patch("/lesoes/{lesao_id}/laudo")
def salvar_laudo_lesao(
    lesao_id: int,
    request: LaudoLesaoRequest,
    db: Session = Depends(get_db)
):
    lesao = db.query(Lesao).filter(Lesao.id == lesao_id).first()

    if not lesao:
        raise HTTPException(status_code=404, detail="Lesão não encontrada")

    lesao.parecer_medico = request.parecer_medico
    lesao.criterios_abcde = request.criterios_abcde
    lesao.veredito_medico = request.veredito_medico

    db.commit()
    db.refresh(lesao)

    return {
        "message": "Laudo salvo com sucesso",
        "lesao_id": lesao.id,
        "parecer_medico": lesao.parecer_medico,
        "criterios_abcde": lesao.criterios_abcde,
        "veredito_medico": lesao.veredito_medico
    }
