---
titulo: Política de Privacidade
descricao: Quais dados o OpENEM guarda, para quê, por quanto tempo, com quem eles são compartilhados e como você exerce os seus direitos.
atualizado: 2026-10-25
---

## Resumo

- O OpENEM guarda o mínimo para você estudar: o e-mail, a senha (só o hash), o nome que você escolher e o que você faz no app.
- Não tem anúncio, não vende dados e não monta perfil seu para publicidade.
- Os outros alunos nunca veem o seu e-mail.
- Em **Perfil**, você baixa todos os seus dados ou exclui a conta quando quiser.

## Quem cuida dos seus dados

O OpENEM é um software livre, com licença AGPL-3.0: qualquer escola, cursinho ou pessoa pode rodar a própria cópia. Quem decide sobre os seus dados é quem opera a cópia que você está usando, o **controlador** (LGPD, art. 5º, VI).

- Controlador: [PLACEHOLDER: nome ou razão social, CPF ou CNPJ e endereço]
- Encarregado pelo tratamento de dados pessoais: [PLACEHOLDER: nome do encarregado]
- Contato do encarregado: [PLACEHOLDER: e-mail de contato]

## Quais dados coletamos e por quê

Para cada dado, abaixo, estão a finalidade, a base legal da LGPD, o tempo que ele fica guardado e com quem é compartilhado. Usamos duas bases legais: **execução de contrato** (art. 7º, V), para prestar o serviço que você pediu ao criar a conta, e **legítimo interesse** (art. 7º, IX), para manter o serviço seguro.

### E-mail

- **Para quê:** identificar a sua conta e entrar no app.
- **Base legal:** execução de contrato.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** ninguém. Os outros alunos não veem o seu e-mail.

### Senha

- **Para quê:** confirmar que é você ao entrar e ao excluir a conta.
- **Como guardamos:** só o hash da senha (argon2), que não permite descobrir a senha. Nem quem opera o servidor consegue ver a sua senha.
- **Base legal:** execução de contrato.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** ninguém.

### Nome de exibição e perfil de estudo

O nome do campo **Como quer ser chamado** (opcional), o objetivo (SISU, ProUni ou Treineiro), os minutos de estudo por dia, a língua estrangeira e as preferências, como o modo sem distrações e a gamificação.

- **Para quê:** mostrar o seu nome no fórum e no ranking e ajustar metas e recomendações.
- **Base legal:** execução de contrato.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** o nome, o objetivo, o nível, a liga, o XP, a sequência de dias e as conquistas aparecem no seu perfil público e no ranking, para os outros alunos que entraram no app. Sem nome escolhido, aparece **Estudante**. Desligando a gamificação em **Perfil**, você sai do ranking.

### Atividade de estudo

Respostas (alternativa escolhida, acerto e tempo), simulados e notas, revisões, favoritos, anotações, flashcards e decks que você criou, votos em decks, fórmulas, cronograma, metas semanais, sessões de Pomodoro, vídeos salvos e as notas deles, redações enviadas, XP, conquistas, sequência de dias e desafios diários.

- **Para quê:** é o próprio serviço: guardar o seu progresso, montar a revisão espaçada, recomendar questões e mostrar o seu desempenho.
- **Base legal:** execução de contrato.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** ninguém. Um deck que você tornar público fica visível para os outros alunos.

### Fórum e temas de cor

Tópicos, respostas, curtidas, denúncias que você fez e temas de cor criados, publicados e curtidos.

- **Para quê:** o fórum de dúvidas e a galeria de temas da comunidade.
- **Base legal:** execução de contrato. A denúncia é guardada por legítimo interesse, para moderar a comunidade.
- **Por quanto tempo:** enquanto a conta existir, ou até você apagar o tópico ou a resposta. A denúncia sai junto com o conteúdo denunciado.
- **Com quem:** tópicos, respostas e temas publicados aparecem para os outros alunos que entraram no app, com o seu nome de exibição. Quem você denunciou não fica sabendo que foi você. As denúncias são lidas por quem modera esta instalação.

### Aceite dos termos

A data e a versão destes documentos que você aceitou ao criar a conta.

- **Para quê:** registrar o aceite dos Termos de Uso e desta política.
- **Base legal:** execução de contrato.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** ninguém.

### Pedidos de comentário por IA

Quando você pede o comentário de uma questão, registramos o pedido (a hora e o tipo de pedido) para contar o limite diário.

- **Para quê:** limitar o uso de um serviço que é pago por quem opera o servidor.
- **Base legal:** legítimo interesse.
- **Por quanto tempo:** enquanto a conta existir.
- **Com quem:** o provedor de IA recebe **só o texto da questão** (enunciado, alternativas e gabarito), nunca o seu e-mail, o seu nome ou qualquer outro dado seu. O comentário gerado fica salvo na questão e serve para todos os alunos.

### Endereço IP e dados de acesso

O servidor web (nginx) registra, a cada acesso, o endereço IP, a data e a hora, o endereço pedido e o navegador. O limite de tentativas conta os pedidos por IP (ou pela conta, quando você entrou) no Redis, e conta as senhas erradas de cada conta.

- **Para quê:** segurança, para proteger o serviço contra abuso, robôs e tentativas de invadir contas.
- **Base legal:** legítimo interesse.
- **Por quanto tempo:** os registros do nginx, [PLACEHOLDER: prazo de retenção dos logs de acesso]. Os contadores do limite de tentativas ficam na memória do Redis e expiram sozinhos, entre 1 segundo e 10 minutos; o bloqueio por senha errada dura de 15 minutos a 24 horas, e nesse contador o e-mail fica guardado como hash.
- **Com quem:** ninguém, a não ser por ordem judicial ou pedido de autoridade previsto em lei.

## Serviços de terceiros

- **Provedor de IA** ([PLACEHOLDER: provedor configurado nesta instalação, ou "nenhum"]): recebe só o texto das questões, como explicado acima.
- **Google Fonts:** o app carrega as fontes dos servidores do Google, que recebem o seu IP e dados do navegador quando você abre o app. O site e a documentação usam fontes próprias e não fazem isso.
- **YouTube:** na Videoteca, o vídeo toca no player do youtube-nocookie.com, que só grava cookies quando você dá play. Ao dar play e ao carregar as miniaturas, o YouTube (Google) recebe o seu IP e dados do navegador. Para buscar o título e a miniatura de um vídeo que você salvou, o servidor envia ao YouTube só o link do vídeo.
- **GitHub:** a tela Ferramentas mostra as estrelas dos repositórios, que o servidor busca no GitHub sem nenhum dado seu. Os links abrem o github.com, e lá vale a política do GitHub.
- **Hospedagem:** [PLACEHOLDER: empresa de hospedagem e país onde ficam os servidores].

Google, YouTube e GitHub ficam fora do Brasil, em geral nos Estados Unidos. O que o seu navegador envia a eles (IP e dados do navegador) é uma transferência internacional de dados (LGPD, art. 33).

## No seu aparelho

Algumas coisas ficam só no navegador e não vão para o servidor: o token da sessão, o tema em uso, os quadros de estudo, os cronômetros e o quadro da sala. O app também guarda no aparelho uma cópia das telas que você abriu, por até 7 dias, e as respostas feitas sem internet até conseguir enviá-las.

Ao excluir a conta, o app apaga deste aparelho o token, essa cópia, as respostas que esperavam envio e os quadros. Ao só sair da conta, apenas o token é apagado: num computador compartilhado, prefira uma janela anônima.

O OpENEM não usa cookies de rastreamento nem ferramentas de análise de audiência.

## Adolescentes

O OpENEM é feito para estudantes do ensino médio e vestibulandos, e muita gente aqui tem de 15 a 17 anos. Por isso:

- Quem tem menos de 18 anos usa o OpENEM com a ciência do responsável, e o cadastro pede essa declaração.
- Crianças com menos de 12 anos não devem criar conta.
- Os dados são tratados no melhor interesse do adolescente, como pedem a LGPD (art. 14) e o Estatuto Digital da Criança e do Adolescente (Lei 15.211/2025).
- Não há anúncio, venda de dados, perfil para publicidade, compra dentro do app nem caixa de recompensa.
- Coletamos só o necessário para estudar: não pedimos nome completo, telefone, escola, endereço, foto nem documento.
- Por padrão, o seu nome aparece como **Estudante**. Não use o nome completo como nome de exibição nem publique dados pessoais no fórum.
- No fórum, você apaga o que escreveu e denuncia o que for ofensa, assédio ou exposição de dados.
- O responsável pode pedir, pelo contato do encarregado, acesso aos dados ou a exclusão da conta do adolescente. Pedimos informações para confirmar que o pedido é legítimo.

## Seus direitos

A LGPD (art. 18) garante a você:

1. Confirmar se tratamos dados seus.
2. Acessar os seus dados: em **Perfil**, **Baixar meus dados** gera um arquivo com tudo o que está ligado à sua conta.
3. Corrigir dados incompletos, inexatos ou desatualizados: o perfil é editável em **Perfil**.
4. Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei.
5. Levar os seus dados para outro serviço (portabilidade): o arquivo de **Baixar meus dados** é JSON, um formato aberto.
6. Pedir a eliminação dos seus dados: em **Perfil**, **Excluir conta** apaga a conta e tudo o que está ligado a ela, na hora.
7. Saber com quais entidades públicas e privadas compartilhamos dados (veja Serviços de terceiros).
8. Saber que pode não dar o consentimento e o que acontece se não der. Hoje nenhum tratamento depende do seu consentimento: sem o aceite dos termos, só não dá para criar a conta.
9. Revogar o consentimento, quando ele for a base legal.

Você também pode se opor a um tratamento feito por legítimo interesse e reclamar na Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.

Para o que não está nos botões do app, escreva ao encarregado: [PLACEHOLDER: e-mail de contato]. Respondemos em até 15 dias.

## Exclusão da conta

Excluir a conta apaga o perfil, as respostas, os simulados, as revisões, os flashcards, o cronograma, as metas, os vídeos, os temas, o XP e as conquistas. Os tópicos que você criou saem com as respostas dos outros alunos, e as suas respostas nos tópicos dos outros também saem. As curtidas e os votos que você deu saem dos totais. Não dá para desfazer: se quiser uma cópia, baixe os seus dados antes.

Cópias de segurança: [PLACEHOLDER: se há backups do banco e por quanto tempo eles guardam dados de contas já excluídas].

## Segurança

As senhas são guardadas com argon2, há limite de tentativas por IP e por conta, e os outros alunos não veem o seu e-mail. Nenhum sistema é totalmente seguro: se acontecer um incidente que possa causar risco ou dano a você, avisamos você e a ANPD (LGPD, art. 48).

## Mudanças nesta política

A data no topo mostra a versão em vigor, e o cadastro guarda a versão que você aceitou. Mudanças relevantes serão avisadas antes de valer, [PLACEHOLDER: como o controlador avisa, por exemplo aviso no app ou e-mail].
