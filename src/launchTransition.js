/** Varighet: 0,6s inn + 0,8s pause + 0,5s ut = 1,9s (jf. style.css) */
const LAUNCH_TOTAL_MS = 1900

function clearLaunchActive() {
  document.documentElement.classList.remove('app-launch-active')
}

/**
 * Synkroniserer splash med gjeldende visning. Kalles etter hver renderApp.
 * – Ikke innlogget / ikke forsiden: fjern splash umiddelbart.
 * – Forsiden: start logo-inn + crossfade (kun én gang mens #app-launch finnes).
 *
 * @param {{ currentUser: unknown, view: string, appMount: HTMLElement | null }} p
 */
export function syncLaunchSplash(p) {
  const { currentUser, view, appMount } = p
  const splash = document.getElementById('app-launch')
  if (!splash) {
    appMount?.classList.remove('app-launch-reveal-target')
    clearLaunchActive()
    return
  }

  if (!currentUser || view !== 'home') {
    splash.remove()
    appMount?.classList.remove('app-launch-reveal-target')
    clearLaunchActive()
    return
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    splash.remove()
    appMount?.classList.remove('app-launch-reveal-target')
    clearLaunchActive()
    return
  }

  if (splash.dataset.launchScheduled === '1') return
  splash.dataset.launchScheduled = '1'

  document.documentElement.classList.add('app-launch-active')
  appMount?.classList.add('app-launch-reveal-target')

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add('app-launch--running')
    })
  })

  window.setTimeout(() => {
    splash.remove()
    appMount?.classList.remove('app-launch-reveal-target')
    clearLaunchActive()
  }, LAUNCH_TOTAL_MS)
}
