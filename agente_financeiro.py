#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agente Local - Exportacao de NFs para Z:\\Financeiro
=====================================================
Este script roda em uma maquina dentro da rede corporativa (com acesso a Z:\\).
Ele consulta o app Assinatura Facil na nuvem por jobs de exportacao pendentes,
baixa os arquivos PDF assinados e grava em Z:\\Financeiro\\NOTAS_<MES>_<ANO>.

A pasta do mes e definida pela data de criacao do envelope (ex: envelope
criado em setembro/2026 -> NOTAS_SETEMBRO_2026). Se a pasta ainda nao existe,
o agente a cria automaticamente.

PRE-REQUISITOS:
  1. Python 3.8+ instalado
  2. pip install requests
  3. Um Personal Access Token do Base44 (Workspace Settings > Personal Access Tokens)
     - Crie um token com permissao de leitura E escrita
  4. A unidade Z:\\ mapeada e acessivel na maquina

COMO USAR:
  1. Edite as configuracoes abaixo (BASE44_TOKEN)
  2. Execute: python agente_financeiro.py
  3. O script roda continuamente, verificando novos jobs a cada 30 segundos
  4. Para parar: Ctrl+C

DICA: Para rodar como servico Windows (auto-iniciar com a maquina):
  - Use o NSSM (https://nssm.cc/) ou o Agendador de Tarefas do Windows
  - Comando: python agente_financeiro.py
"""

import requests
import os
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

# ============================================================
# CONFIGURACOES - EDITE AQUI
# ============================================================

# Token de acesso pessoal do Base44 (Workspace Settings > Personal Access Tokens)
# Crie um token com permissao de leitura e escrita
BASE44_TOKEN = "SEU_TOKEN_AQUI"

# ID do app (Assinatura Facil)
APP_ID = "6aa074a5ce060f1b2caeee8f"

# URL base do Base44
BASE44_URL = "https://app.base44.com"

# Caminho base no Z: (unidade de rede)
Z_BASE = r"Z:\Financeiro"

# Intervalo entre verificacoes (segundos)
POLL_INTERVAL = 30

# ============================================================

HEADERS = {
    "Authorization": f"Bearer {BASE44_TOKEN}",
    "Content-Type": "application/json"
}


def get_pending_jobs():
    """Busca jobs de exportacao pendentes no Base44."""
    url = f"{BASE44_URL}/api/apps/{APP_ID}/entities/ExportFinanceiro"
    params = {"filter": '{"status":"pendente"}'}
    resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def update_job(job_id, data):
    """Atualiza o status de um job no Base44."""
    url = f"{BASE44_URL}/api/apps/{APP_ID}/entities/ExportFinanceiro/{job_id}"
    resp = requests.put(url, json=data, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def download_file(url, dest_path):
    """Baixa um arquivo de uma URL e salva no caminho de destino."""
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)


def process_job(job):
    """Processa um job de exportacao: baixa arquivos e grava em Z:."""
    job_id = job["id"]
    caminho = job.get("caminho_destino", "")
    arquivos = job.get("arquivos", [])

    if not arquivos:
        update_job(job_id, {"status": "erro", "erro_mensagem": "Nenhum arquivo no job"})
        return

    if not caminho:
        update_job(job_id, {"status": "erro", "erro_mensagem": "Caminho de destino vazio"})
        return

    # Criar pasta de destino se nao existir (ex: Z:\Financeiro\NOTAS_OUTUBRO_2026)
    pasta = Path(caminho)
    pasta.mkdir(parents=True, exist_ok=True)

    print(f"  -> Pasta: {caminho}")

    # Baixar cada arquivo
    for i, url in enumerate(arquivos):
        # Nome do arquivo a partir da URL
        nome = unquote(url.split("/")[-1])
        if not nome or "." not in nome:
            nome = f"arquivo_{i+1}.pdf"

        dest = pasta / nome
        print(f"  -> Baixando: {nome}")
        download_file(url, str(dest))

    # Marcar como concluido
    update_job(job_id, {
        "status": "concluido",
        "data_export": datetime.now().isoformat()
    })
    print(f"  [OK] Job {job_id} concluido - {len(arquivos)} arquivo(s)")


def main():
    print("=" * 60)
    print("Agente Local - Exportacao de NFs para Z:\\Financeiro")
    print("=" * 60)
    print(f"Base: {Z_BASE}")
    print(f"Intervalo: {POLL_INTERVAL}s")
    print()

    if BASE44_TOKEN == "SEU_TOKEN_AQUI":
        print("ERRO: Configure o BASE44_TOKEN no script!")
        print("      Workspace Settings > Personal Access Tokens > Criar token")
        return

    while True:
        try:
            jobs = get_pending_jobs()
            if jobs:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] {len(jobs)} job(s) pendente(s)")
                for job in jobs:
                    print(f"  Processando: {job.get('documento_titulo', job['id'])}")
                    try:
                        process_job(job)
                    except Exception as e:
                        print(f"  [ERRO] {e}")
                        try:
                            update_job(job["id"], {"status": "erro", "erro_mensagem": str(e)})
                        except:
                            pass
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Nenhum job pendente")
        except Exception as e:
            print(f"Erro ao consultar jobs: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()