# Contribuindo para o OpENEM

[Read in English](.github/docs/CONTRIBUTING-EN.md)

Antes de mais nada, obrigado por dedicar seu tempo para contribuir! São pessoas como você que tornam este projeto melhor para todos.

Todos os tipos de contribuições são bem-vindos, desde relatórios de bugs até novas *features* e melhorias na documentação.

---

## Começando

### 1. Relatando Bugs
Antes de criar um relatório de bug, verifique a [aba Issues](https://github.com/migueldsants/OpENEM/issues) para ver se o problema já foi relatado.

Ao criar um relatório de bug, por favor inclua:
* Um título claro e descritivo.
* Passos para reproduzir o problema.
* O comportamento observado vs. o comportamento esperado.
* Screenshots, se aplicável.

### 2. Sugerindo Melhorias
Se você tem uma ideia para uma nova *feature* ou melhoria:
1.  Abra uma **Issue** para discuti-la antes de iniciar qualquer trabalho.
2.  Explique por que essa melhoria seria útil e como ela deve funcionar.

---

## Processo de Desenvolvimento

Se você deseja contribuir com código, por favor siga este fluxo de trabalho:

### 1. Forking
* Faça um **Fork** do repositório para sua própria conta GitHub.
* Faça um **Clone** do seu fork localmente.

### 2. Configuração de Branching
* Crie uma nova branch para o seu trabalho (não trabalhe diretamente na `main` ou `master`):
    ```bash
    git checkout -b feature/nome-da-sua-feature
    # OU
    git checkout -b fix/nome-da-sua-correcao
    ```

### 3. Coding Standards
* Mantenha o estilo de código e indentação existentes.
* Comente seu código onde necessário.
* Certifique-se de que suas alterações não quebrem funcionalidades existentes.

### 4. Commit Messages
Recomendamos usar **Conventional Commits**:
* `feat: add new user login`
* `fix: resolve crash on dashboard`
* `docs: update installation instructions`

### 5. Push e Pull Request
* Faça o Push da sua branch para o GitHub:
    ```bash
    git push origin feature/nome-da-sua-feature
    ```
* Abra um **Pull Request (PR)** do seu fork para a nossa branch `main`.
* Descreva suas alterações detalhadamente e linke quaisquer *issues* relacionadas (ex: `Closes #123`).

6. Segurança
A segurança dos usuários e dos dados é uma prioridade. No entanto, não abra Issues para relatar vulnerabilidades ou falhas de segurança.
Leia [SECURITY.md](../../SECURITY.md)
---

## ⚖️ License

Ao contribuir para o **OpENEM**, você concorda que suas contribuições serão licenciadas sob a **GNU Affero General Public License v3.0 (AGPL-3.0)**. 

Você pode encontrar o texto completo da licença no arquivo [LICENSE](./LICENSE) na raiz deste repositório.
