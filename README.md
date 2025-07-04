# Processamento cashback

## Contexto

Esse projeto foi realizado visando simular o fluxo de processamento de cashback de um ecommerce, seguindo o fluxo descrito abaixo:

1. Uma chamada POST para o endpoint `/orders`, simulando a criação de compras do ecommerce, com o seguinte body:

```bash
{
    "percentage_cashback": 9.99, //porcentagem do cashback a sser processado
    "email": "gabrielnogueira@gmail.com", //email do cliente
    "value": 100, // valor do pedido
    "status": "CASHBACK_PENDENTE" // status do pedido.
}
```

2. O pedido é incluido na fila RabbitMQ.
3. A fila é processada sempre que o tamanho do lote for atingido, mudando o status do pedido para `CASHBACK_PROCESSADO` (você pode definir o tamanho do lote através da variável de ambiente `BATCH_SIZE`, caso esse valor não seja passado, o tamanho padrão do lote é 10)
4. Se o processamento da mensagem falhar, a mensagem será enviada para uma fila de retry com ttl de 10 segundos. Você pode definir quantas vezes essa mensagem pode ser processada através da variável de ambiente `MAX_RETRIES`, caso esse número se exceda, a mensagem será enviada para uma fila dlq.
5. Se o processamento do lote for executado com sucesso, a confirmação da operação pode ser vista nos registros do banco com o campo `status` definido como `CASHBACK_PROCESSADO`.

## Pré-requisitos

- WSL
- Docker devidamente instalado e atualizado

## Configuração

1. Clone esse repositório.
2. Defina as variáveis de ambiente no arquivo `.env` com os seguintes valores:

```bash
DB_USER='user'
DB_PASSWORD='password'
DB_HOST='localhost'
DB_DATABASE='ecommerce'
DB_PORT=5456

RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672

BATCH_SIZE=1

MAX_RETRIES=2
```

3. No Terminal execute `docker-compose up --build -d app`
4. O processo de deploy dos containers será iniciado.
5. Após a configuração, a aplicação será exposta na porta `3000`, o banco de dados postgres na porta `5456`, a interface do rabbitMQ na porta `15672`, e a fila rabbitMQ na porta `5672`

## Design patterns

### Retry

Implementação do design pattern de retry na lógca de consumo da fila rabbitMQ, visando tornar a aplicação resiliente, se recuperando de falhas transitórias

### Repository

Implementação do design-pattern no consumo do banco de dados postgres, para desacoplar a lógica do banco da lógica da aplicação

## Estrutura da aplicação

        [ HTTP POST /orders ]
                  │
                  ▼
          [Insert Banco de dados]
                  │
                  ▼
         [Inclusão na fila RabbitMQ]
                  │
                  ▼
         [queue.consumer.ts]
                  │
                  ▼
        [batch.service.ts]
                │
                ▼
            [orders.service.ts]
               │
               ▼
        [UPDATE Banco de dados]
