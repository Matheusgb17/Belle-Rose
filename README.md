# 🌸 Belle Rosé - Sistema de Gestão e Agendamento

Bem-vindo ao repositório do **Belle Rosé**, uma plataforma web interativa desenvolvida para digitalizar e otimizar o atendimento de salões de beleza. 

Este projeto faz a ponte entre clientes, que buscam autonomia para agendar horários, e a administração do salão, que precisa de controle sobre agendas, serviços, profissionais e indicadores de faturamento.

## 🚀 Funcionalidades

O sistema é dividido em duas áreas principais:

### 1. Visão do Cliente (Interface Pública)
- **Catálogo de Serviços e Promoções:** Visualização de todos os procedimentos oferecidos e campanhas de desconto ativas.
- **Agendamento em Etapas:** Fluxo intuitivo para seleção de profissional, serviço, data, horário e preenchimento de dados de contato.
- **Gestão de Agendamentos:** Área para consulta e cancelamento rápido de horários utilizando apenas o número de telefone.

### 2. Área Restrita (Painel Administrativo)
- **Dashboard:** Gráficos e indicadores de desempenho (faturamento, procedimentos mais realizados, etc).
- **Controle de Agenda:** Visão cronológica dos agendamentos (por profissional ou visão geral para o administrador).
- **Gestão (CRUD):** Módulos completos para cadastro, edição e exclusão de **Procedimentos**, **Promoções** e **Profissionais**.

## 🛠️ Arquitetura e Tecnologias

- **Frontend:** Desenvolvido em **React.js** com a ferramenta de construção **Vite**.
- **Estilização:** Utilitários CSS para um design responsivo (Mobile-First / Layout Fluido).
- **Status Atual:** A aplicação opera no modelo **Single Page Application (SPA)** como um *Frontend Estático*. As ações de banco de dados e autenticação estão *mockadas* (simuladas) no navegador, preparadas para futura integração com uma API/Backend real.

## 💻 Como rodar o projeto localmente

Para executar este projeto na sua máquina, você precisará do **Node.js** e do **NPM** instalados.

1. Clone o repositório:
```bash
git clone [https://github.com/Matheusgb17/Belle-Rose.git](https://github.com/Matheusgb17/Belle-Rose.git)
```
2. Acesse a pasta do projeto:

```Bash
cd Belle-Rose
```
3. Instale as dependências:

```Bash
npm install
```
4. Inicie o servidor de desenvolvimento:
```Bash
npm run dev
```
Abra o link gerado no terminal (geralmente http://localhost:5173) no seu navegador.

## 👥 Integrantes do Grupo
Gustavo Henrique

Iasmim Garcia

Matheus Garcia

Patrick Nunes
