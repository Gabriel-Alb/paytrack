# frontend

Produção usa build Vite servido por Nginx sem root. Consulte [o guia de deploy](../docs/DEPLOY.md) para Docker, HTTPS, API separada e cache da SPA. `vite preview` permanece apenas como ferramenta de pré-visualização local.

## Administração por empresa e regressões

Consulte [as regras e endpoints de acesso empresarial](../docs/COMPANY_ACCESS.md).
`npm test` executa testes unitários; `npm run test:e2e` abre uma API com SQLite em
memória e Vite em `127.0.0.1:5179`, usando a porta `33021` para a API. Instale as
dependências do backend e o Chromium antes da primeira execução:

```sh
npm ci
npm ci --prefix ../backend
npx playwright install chromium
npm run test:e2e
```

O teste cobre solicitação multiempresa, aprovação parcial, recusa remanescente,
escopo de gerente, accordion, promoção/rebaixamento, último gerente e revogação
de acesso; usa viewports 1440×1000 e 390×844 e falha com erros de aplicação ou
avisos no console. Sessões, contas e banco são descartados ao terminar. Screenshots
e resultados ficam no diretório temporário do sistema; `E2E_ARTIFACT_DIR` permite
escolher outro diretório existente. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite usar
um Chrome local; `PLAYWRIGHT_MODULE` permite um runtime Playwright já provisionado.
O modo Vite `test` desativa apenas as ferramentas de desenvolvimento visuais.

## Notificações de operações

`ToastHost` fica montado uma única vez em `App.vue`, inclusive nas rotas públicas.
Views, componentes e composables utilizam a mesma API:

```js
import { toast } from '@/composables/useToast'

toast.success('Dados atualizados com sucesso.')
toast.error(error) // aceita Error ou texto; ignora AbortError
toast.warning('Selecione pelo menos uma empresa.')
toast.info('As informações foram atualizadas.')
toast.error('Não foi possível carregar os dados.', {
  action: { label: 'Tentar novamente', run: reload },
})
```

Notifique sucesso após a escrita ser confirmada. `request` lança erros para o
chamador tratar; `perform` já mostra o toast de erro, evitando notificações
duplicadas. Não adicione alertas locais nem `alert()`.

O host exibe até três toasts no desktop (canto inferior direito) e um no mobile
(abaixo do cabeçalho), mantendo os demais em fila. O tempo de exibição começa
quando cada item aparece e pausa com hover, foco ou aba oculta. Mensagens iguais
em exibição/na fila são agrupadas. O histórico de atividades continua usando
`useNotifications`, separado dos avisos temporários de operações.

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```
