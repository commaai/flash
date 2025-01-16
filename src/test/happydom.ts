import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register({
  settings: {
    fetch: {
      disableSameOriginPolicy: true,
    },
  },
})
