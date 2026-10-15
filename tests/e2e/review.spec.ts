import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { makeEmptyProfile, makeHistory, makeMatchDetail, makeProfile } from '../fixtures/review'
import AxeBuilder from '@axe-core/playwright'

const PROFILE = '/players/euw1/NamiMain-MDS'
const HISTORY = `${PROFILE}/history`
const DETAIL = `${HISTORY}/EUW1_1000`

// Every Riot-backed API route answers from fixtures; the requests are recorded.
async function mockApi(page: Page, profile = makeProfile()) {
  const requests: URL[] = []
  await page.route('**/api/profile?*', (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const period = url.searchParams.get('period') ?? '20-30'
    const [count, days] = period.split('-').map(Number)
    return route.fulfill({ json: { ...profile, period: { id: period, count, days } } })
  })
  await page.route('**/api/history?*', (route) => {
    const url = new URL(route.request().url())
    requests.push(url)
    const start = Number(url.searchParams.get('start') ?? 0)
    return route.fulfill({ json: makeHistory(start, start ? null : 20) })
  })
  await page.route('**/api/match?*', (route) => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ json: makeMatchDetail() })
  })
  return requests
}

async function checkAccessibility(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([])
}

test('home, profile, game detail, history and mobile pass automated accessibility checks', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  await checkAccessibility(page)
  await page.goto(PROFILE)
  await expect(page.locator('.overview-panels')).toBeVisible()
  await checkAccessibility(page)
  await page.goto(DETAIL)
  await expect(page.locator('.roster')).toHaveCount(2)
  await checkAccessibility(page)
  await page.goto(HISTORY)
  await expect(page.locator('.match-row')).toHaveCount(12)
  await checkAccessibility(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PROFILE)
  await expect(page.getByRole('heading', { name: 'À revoir' })).toBeVisible()
  await checkAccessibility(page)
})

test('search with a server opens a shareable profile of ranked figures with a period choice', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const requests = await mockApi(page)
  await page.goto('/')
  const search = page.locator('.welcome-search')
  await expect(search.getByRole('combobox', { name: 'Serveur' })).toHaveValue('euw1')
  await search.getByRole('combobox', { name: 'Serveur' }).selectOption('kr')
  await search.getByRole('textbox').fill('Étoile Bleue#KR1')
  await search.getByRole('textbox').press('Enter')
  await expect(page).toHaveURL('/players/kr/%C3%89toile%20Bleue-KR1')
  await expect.poll(() => requests.at(-1)?.searchParams.get('platform')).toBe('kr')
  expect(requests.at(-1)?.searchParams.get('riotId')).toBe('Étoile Bleue#KR1')

  await page.goto(PROFILE)
  await expect(page.getByRole('heading', { name: 'NamiMain#MDS' })).toBeVisible()
  await expect(page.locator('.level-badge')).toHaveText('Niv. 245')
  await expect(page.locator('.main-roles')).toHaveText('Support')
  await expect(page.locator('.ranked-line')).toContainText('Solo/Duo : Or II · 45 LP · 30 V – 25 D')
  await expect(page.locator('.ranked-line')).toContainText('Flex : Non classé')
  await expect(page.getByRole('img', { name: 'Icône de profil' }).first()).toBeVisible()
  await expect(page.locator('.stat-wins')).toContainText('60 %')
  await expect(page.locator('.stat-kda')).toContainText('3,8')
  await expect(page.locator('.stat-games')).toContainText('10')
  await expect(page.locator('.champion-grid figcaption').first()).toContainText(
    'Nami4 parties100 % de victoires · KDA 7,4',
  )
  await expect(page.locator('.latest-match')).toHaveCount(5)
  await expect(page.locator('.performance-panel')).toContainText('Participation aux éliminations')

  const period = page.getByRole('combobox', { name: 'Période' })
  await expect(period).toHaveValue('20-30')
  await expect(period.locator('option')).toHaveText([
    '20 parties · 30 jours',
    '30 parties · 60 jours',
    '30 parties · 90 jours',
  ])
  await period.selectOption('30-90')
  await expect(page).toHaveURL(`${PROFILE}?periode=30-90`)
  await expect(page.locator('.sample-notice')).toContainText('« 30 parties · 90 jours »')
  await expect.poll(() => requests.at(-1)?.searchParams.get('period')).toBe('30-90')

  await page.locator('.latest-match').first().click()
  await expect(page).toHaveURL(DETAIL)
  await expect.poll(() => requests.at(-1)?.searchParams.get('id')).toBe('EUW1_1000')
  expect(requests.at(-1)?.searchParams.get('riotId')).toBe('NamiMain#MDS')
  expect(errors).toEqual([])
})

test('game detail shows both rosters, team totals, the winner and links to every player', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto(DETAIL)
  await expect(page.getByRole('heading', { name: 'Classée Solo/Duo' })).toBeVisible()
  await expect(page.locator('.match-meta')).toContainText('30:35')
  await expect(page.locator('.match-meta')).toContainText('EUW')
  const blue = page.getByRole('region', { name: 'Équipe bleue' })
  const red = page.getByRole('region', { name: 'Équipe rouge' })
  await expect(blue.locator('.roster-player')).toHaveCount(5)
  await expect(red.locator('.roster-player')).toHaveCount(5)
  await expect(blue).toHaveClass(/is-winner/)
  await expect(blue.locator('.result-badge')).toHaveText('Victoire')
  await expect(red.locator('.result-badge')).toHaveText('Défaite')
  await expect(blue.locator('.roster-score')).toContainText('30 / 14 / 45')
  await expect(red.locator('.roster-score')).toContainText('14 / 30 / 21')
  const reviewed = blue.locator('.roster-player.is-reviewed')
  await expect(reviewed).toHaveCount(1)
  await expect(reviewed).toContainText('NamiMain#MDS')
  await expect(reviewed).toContainText('Joueur suivi')
  await expect(reviewed).toContainText('4 / 2 / 18')
  await expect(red.locator('.roster-player').first()).toContainText('Top')

  const name = red.getByRole('link', { name: 'Rouge Darius#EUW', exact: true })
  await expect(name).toHaveAttribute('href', '/players/euw1/Rouge%20Darius-EUW')
  await expect(
    red.getByRole('link', { name: 'Darius, profil de Rouge Darius#EUW' }),
  ).toHaveAttribute('href', '/players/euw1/Rouge%20Darius-EUW')
  await name.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/players/euw1/Rouge%20Darius-EUW')
})

test('history lists every mode, filters, loads 20 more from Riot and opens game details', async ({
  page,
}) => {
  const requests = await mockApi(page)
  await page.goto(PROFILE)
  await page.getByRole('link', { name: 'Voir plus' }).click()
  await expect(page).toHaveURL(HISTORY)
  await expect(page.getByRole('heading', { name: 'Historique des parties' })).toBeVisible()
  await expect(page.locator('.match-row')).toHaveCount(12)
  await expect(page.locator('.match-row').nth(2)).toContainText('ARAM')
  await expect(page.locator('.match-row').nth(2)).toContainText('Aucun')
  await expect(page.locator('.match-row').nth(3)).toContainText('Remake')
  await page.getByRole('button', { name: 'Afficher plus' }).click()
  await expect(page.locator('.match-row')).toHaveCount(22)
  await expect.poll(() => requests.at(-1)?.searchParams.get('start')).toBe('20')
  await expect(page.getByText('Toutes les parties disponibles sont affichées.')).toBeVisible()
  await page.getByRole('combobox', { name: 'Résultat', exact: true }).selectOption('loss')
  await expect(page.locator('.match-row')).toHaveCount(9)
  await page.getByRole('combobox', { name: 'Mode de jeu' }).selectOption('450')
  await expect(page.getByRole('heading', { name: 'Aucune partie ne correspond.' })).toBeVisible()
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click()
  await expect(page.locator('.match-row')).toHaveCount(22)
  await page.locator('.match-row a').first().focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(DETAIL)
  await page.goBack()
  await expect(page.locator('.match-row')).toHaveCount(22)
})

test('mobile: champion picture, tied roles, defeats only to review, and links to the game', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const profile = makeProfile()
  profile.summary.mainRoles = ['UTILITY', 'JUNGLE']
  await mockApi(page, profile)
  await page.goto(PROFILE)
  await expect(page.getByRole('img', { name: 'Champion le plus joué : Nami' })).toBeVisible()
  await expect(page.locator('.profile-role')).toContainText('#MDS · Support · Jungle')
  await expect(page.locator('.overview-panels')).toBeHidden()
  await expect(page.locator('.review-card')).toHaveCount(3)
  for (const card of await page.locator('.review-card').all())
    await expect(card).toContainText('Défaite')
  await page.locator('.review-detail').first().click()
  await expect(page).toHaveURL(`${HISTORY}/EUW1_1001`)
  await expect(page.locator('.roster')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.goto(PROFILE)
  await page.getByRole('link', { name: 'Toutes les parties' }).click()
  await expect(page).toHaveURL(HISTORY)
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await page.getByRole('link', { name: 'Profil joueur', exact: true }).click()
  await expect(page).toHaveURL(PROFILE)
})

test('a period without ranked games says so, links to the history and falls back to the icon', async ({
  page,
}) => {
  await mockApi(page, makeEmptyProfile())
  await page.goto(PROFILE)
  await expect(
    page.getByRole('heading', { name: 'Aucune partie classée sur cette période.' }),
  ).toBeVisible()
  await expect(page.locator('.stat-wins')).toContainText('—')
  await expect(page.locator('.stat-games')).toContainText('0')
  await expect(page.locator('.main-roles')).toHaveCount(0)
  await page.getByRole('link', { name: 'Voir l’historique' }).click()
  await expect(page).toHaveURL(HISTORY)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(PROFILE)
  await expect(page.getByRole('img', { name: 'Icône de profil' }).last()).toBeVisible()
  await expect(page.locator('.mobile-tag')).toHaveText('#MDS')
})

test('partial loads and remakes are reported next to the figures', async ({ page }) => {
  const profile = makeProfile()
  profile.sample = { found: 12, unavailable: 2, remakes: 1, excluded: 0 }
  await mockApi(page, profile)
  await page.goto(PROFILE)
  await expect(page.getByText('Chargement partiel :', { exact: false })).toBeVisible()
  await expect(page.getByText('1 remake exclu des statistiques.')).toBeVisible()
})

test('rate limit shows Retry-After and keeps retry disabled until the deadline', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/profile?*', (route) => {
    requests++
    return route.fulfill({
      status: 429,
      json: {
        data: {
          code: 'RIOT_RATE_LIMITED',
          message: 'Patientez avant de réessayer.',
          retryAfter: 120,
        },
      },
    })
  })
  await page.goto(PROFILE)
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeDisabled()
  await expect(page.getByRole('timer')).toContainText('Nouvelle recherche possible')
  expect(requests).toBe(1)
})

test('not found, and an unreadable player URL, are explained', async ({ page }) => {
  await page.route('**/api/profile?*', (route) =>
    route.fulfill({
      status: 404,
      json: { data: { code: 'RIOT_NOT_FOUND', message: 'Ce Riot ID n’a pas de profil sur KR.' } },
    }),
  )
  await page.goto('/players/kr/NamiMain-MDS')
  await expect(page.getByRole('heading', { name: 'Ce joueur reste introuvable.' })).toBeVisible()
  await expect(page.getByText('Ce Riot ID n’a pas de profil sur KR.')).toBeVisible()
  await page.goto('/players/euw1/NamiMain')
  await expect(page.getByRole('heading', { name: 'Cette adresse est incomplète.' })).toBeVisible()
})

test('links from the EUW-only version redirect to the new routes', async ({ page }) => {
  await mockApi(page)
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page).toHaveURL(PROFILE)
  await page.goto('/historique?joueur=NamiMain%23MDS')
  await expect(page).toHaveURL(HISTORY)
})

test('server rejects malformed input before any external call', async ({ request }) => {
  for (const [url, code] of [
    ['/api/profile?platform=euw1&riotId=invalid', 'INVALID_RIOT_ID'],
    ['/api/profile?platform=xx1&riotId=NamiMain%23MDS', 'INVALID_PLATFORM'],
    ['/api/profile?platform=euw1&riotId=NamiMain%23MDS&period=7-7', 'INVALID_PERIOD'],
    ['/api/history?platform=euw1&riotId=NamiMain%23MDS&start=-1', 'INVALID_START'],
    ['/api/match?id=nope', 'INVALID_MATCH_ID'],
  ]) {
    const response = await request.get(url!)
    expect(response.status(), url).toBe(400)
    const body = await response.json()
    expect(body.data.code).toBe(code)
    expect(JSON.stringify(body)).not.toContain('X-Riot-Token')
  }
})

test('capture the reference views, the game detail and the welcome screen', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.screenshot({ path: 'docs/screenshots/welcome.png', fullPage: true })
  await page.goto(PROFILE)
  await expect(page.locator('.overview-panels')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'docs/screenshots/profile-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Voir plus' }).click()
  await expect(page.locator('.match-row')).toHaveCount(12)
  await page.screenshot({ path: 'docs/screenshots/history-desktop.png', fullPage: true })
  await page.goto(DETAIL)
  await expect(page.locator('.roster')).toHaveCount(2)
  await page.screenshot({ path: 'docs/screenshots/match-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 577, height: 1024 })
  await page.goto(PROFILE)
  await expect(page.getByRole('heading', { name: 'À revoir' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/profile-mobile.png', fullPage: true })
  await page.goto(DETAIL)
  await expect(page.locator('.roster')).toHaveCount(2)
  await page.screenshot({ path: 'docs/screenshots/match-mobile.png', fullPage: true })
})

test('profile, history and game detail do not overflow at mobile and tablet breakpoints', async ({
  page,
}) => {
  await mockApi(page)
  for (const width of [320, 577, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [PROFILE, HISTORY, DETAIL]) {
      await page.goto(path)
      await page.locator('.profile-hero,.history-heading,.match-summary').waitFor()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} at ${width}px`,
      ).toBe(true)
    }
  }
})
