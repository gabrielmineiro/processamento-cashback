# Processamento de Cashback

Sistema de processamento de cashback usando NestJS e RabbitMQ com processamento em lotes.

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose

## Configuração

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar RabbitMQ
```bash
docker-compose up -d
```

### 3. Executar a aplicação
```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run start:prod
```

## Uso

### Enviar evento para processamento
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"userId": 123, "amount": 100, "type": "cashback"}'
```

### Acessar RabbitMQ Management
- URL: http://localhost:15672
- Usuário: admin
- Senha: admin

## Arquitetura

- **EventsController**: Recebe eventos via HTTP e envia para a fila
- **RabbitMQService**: Gerencia conexão e operações com RabbitMQ
- **BatchWorker**: Processa mensagens em lotes de 10 itens
- **Dead Letter Queue**: Mensagens com falha são redirecionadas para DLQ

## Scripts

```bash
# Desenvolvimento
npm run start:dev

# Build
npm run build

# Testes
npm run test

# Linting
npm run lint
```