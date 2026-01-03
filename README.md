# Sistema de Gestão Clínica (Offline-First) 🏥

Aplicação Desktop desenvolvida com **Electron.js** focada em resiliência e operação offline para clínicas médicas e odontológicas.

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Electron](https://img.shields.io/badge/Electron-Latest-blue)

## 📸 Funcionalidades

- **Funcionamento 100% Offline:** Dados salvos localmente, garantindo acesso mesmo sem internet.
- **Gestão de Documentos:** Geração automática de Contratos e Anamneses para impressão (`anamnese-print.html`).
- **Odontograma:** Suporte visual para tratamento dentário.
- **Arquitetura Desktop:** Integração nativa com o sistema operacional via Electron.

## 🚀 Como rodar o projeto

Este projeto utiliza Node.js. Para testar em sua máquina:

```bash
# 1. Clone o repositório
git clone https://github.com/Alex30pro/clinica-electron.git

# 2. Instale as dependências
npm install

# 3. Inicie a aplicação
npm start

🛠️ Tecnologias Utilizadas
Core: Electron.js (Main & Renderer Processes).

Interface: HTML5, CSS3, JavaScript Vanilla.

Persistência: JSON / LocalStorage (Foco em simplicidade e portabilidade).

Projeto desenvolvido para fins de estudo em Desenvolvimento Desktop e Segurança de Dados Locais.
