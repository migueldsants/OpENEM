---
titulo: Revisão
descricao: Como a revisão espaçada decide quando cada assunto volta, e como fazer uma sessão de revisão no OpENEM.
---

## Para que serve a Revisão

Estudar um assunto uma vez não basta: a gente esquece. A revisão espaçada traz cada assunto de volta pouco antes de você esquecer, com intervalos que crescem conforme você acerta.

Toda vez que você responde uma questão que tem assunto, seja em Questões, num simulado ou na própria Revisão, o app agenda quando esse assunto deve voltar. A tela **Revisão** lista os assuntos que já venceram, do mais atrasado ao mais recente, com o aviso **vence hoje** ou **atrasado** e o número de dias.

> **Atenção:** só entram na revisão as questões que já têm assunto classificado. Parte do banco oficial ainda não tem. Essas respostas contam no seu desempenho, mas não agendam revisão.

## Como o app decide a data

O OpENEM usa uma versão simplificada do método SM-2. Para cada assunto ele guarda duas coisas: um intervalo em dias e um **fator de facilidade**, que começa em 2,5.

| O que aconteceu | Quando o assunto volta |
| --- | --- |
| Errou a questão | Amanhã, e a contagem de acertos recomeça |
| 1º acerto seguido | Em 1 dia |
| 2º acerto seguido | Em 6 dias |
| Do 3º acerto em diante | Intervalo anterior multiplicado pelo fator de facilidade |

Na prática, acertando sempre, o assunto volta em 1 dia, depois em 6, depois em cerca de 16 e depois em mais de um mês.

O fator de facilidade sobe quando você vai bem e desce quando você erra ou acha difícil, mas nunca fica abaixo de 1,3. Por isso, assuntos que você domina se espaçam rápido, e os difíceis voltam com mais frequência.

## Fazer uma sessão de revisão

1. Na tela **Revisão**, toque em **Revisar** num assunto.
2. O app mostra até 5 questões desse assunto. Escolha a alternativa e toque em **Responder** em cada uma.
3. Se você tem anotação numa delas, toque no botão de nota para ver **Sua anotação**.
4. No fim, em **Como foi sua lembrança?**, escolha uma opção.
5. O assunto sai da lista e volta na nova data.

Para sair sem avaliar, toque em **Voltar**. As respostas dadas dentro da sessão também entram na conta, junto com a sua avaliação.

## O que cada avaliação faz

- **Esqueci**: o assunto recomeça e volta amanhã. O fator de facilidade cai bastante.
- **Difícil**: conta como lembrado, mas o fator cai, então as próximas voltas vêm mais cedo.
- **Bom**: conta como lembrado e mantém o fator.
- **Fácil**: conta como lembrado e aumenta o fator, então as próximas voltas ficam mais espaçadas.

Seja honesto na avaliação: marcar **Fácil** num assunto que você não domina só adia o problema. Com a gamificação ligada, cada avaliação também vale XP.

## Saber quando é a próxima revisão

Quando nada venceu, a tela mostra **Tudo em dia!**. O **Painel** mostra a **Próxima revisão** agendada e quanto falta para ela, e a tela **Início** coloca a revisão em primeiro lugar sempre que há assunto vencido.

Sem internet, a avaliação fica guardada no aparelho e é enviada quando a conexão voltar. Veja [Instalar e usar offline](/docs/alunos/instalar-e-offline/).

> **Dica:** os [flashcards](/docs/alunos/flashcards/) também usam **Esqueci**, **Difícil**, **Bom** e **Fácil**, mas com intervalos fixos. A Revisão é por assunto e os intervalos crescem.
