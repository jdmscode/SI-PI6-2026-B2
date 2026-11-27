from sqlalchemy import Column, Integer, String, ForeignKey, Text, Float, JSON
from database import Base


class Medico(Base):
    __tablename__ = "medicos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100))
    crm = Column(String(20), unique=True, index=True)
    estado = Column(String(2))
    senha = Column(String(255))

class Paciente(Base):
        __tablename__ = "pacientes"

        id = Column(Integer, primary_key=True, index=True)
        nome = Column(String(100))
        idade = Column(Integer)
        cpf = Column(String(14))
        ultima_consulta = Column(String(20))
        lesoes = Column(Integer, default=0)
        risco = Column(String(20))
        
        medico_id = Column(Integer, ForeignKey("medicos.id"))

class Lesao(Base):
    __tablename__ = "lesoes"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(String(20))
    posicao_x = Column(Float)
    posicao_y = Column(Float)
    posicao_z = Column(Float)
    descricao = Column(Text)
    risco = Column(String(20))
    classificacao = Column(String(20))
    confianca = Column(String(20))
    imagem_path = Column(String(255))
    paciente_id = Column(Integer, ForeignKey("pacientes.id"))
    localizacao = Column(String(30))
    parecer_medico = Column(Text, nullable=True)
    criterios_abcde = Column(JSON, nullable=True)
    veredito_medico = Column(String(20), nullable=True)
    resultado_ia = Column(JSON, nullable=True)
