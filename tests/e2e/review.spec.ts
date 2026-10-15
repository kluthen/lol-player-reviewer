import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { makeReview } from '../fixtures/review'
import AxeBuilder from '@axe-core/playwright'

async function mockReview(page: Page) {
  await page.route('**/api/review?*', (route) => route.fulfill({ json: makeReview() }))
}

test('welcome, profile, history, dialog and mobile pass automated accessibility checks', async ({
  page,
}) => {
  await mockReview(page)
  const check = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
    ).toEqual([])
  }
  await page.goto('/')
  await check()
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.locator('.overview-panels')).toBeVisible()
  await check()
  await page.locator('.latest-match').first().click()
  await check()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Voir plus' }).click()
  await check()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.getByRole('heading', { name: 'À revoir' })).toBeVisible()
  await check()
})

test('search, profile, history, combined filters, more results and keyboard details', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockReview(page)
  await page.goto('/')
  await page.locator('.welcome-search input').fill('NamiMain#MDS')
  await page.locator('.welcome-search input').press('Enter')
  await expect(page.getByRole('heading', { name: 'NamiMain#MDS' })).toBeVisible()
  await expect(page.locator('.stat-wins')).toContainText('60 %')
  await expect(page.locator('.stat-kda')).toContainText('3,8')
  await page.getByRole('link', { name: 'Voir plus' }).click()
  await expect(page.getByRole('heading', { name: 'Historique des parties' })).toBeVisible()
  await expect(page.locator('.match-row')).toHaveCount(5)
  await page.getByRole('button', { name: 'Afficher plus' }).click()
  await expect(page.locator('.match-row')).toHaveCount(10)
  await page.getByRole('combobox', { name: 'Résultat', exact: true }).selectOption('loss')
  await expect(page.locator('.match-row')).toHaveCount(4)
  await page.getByRole('combobox', { name: 'Mode de jeu' }).selectOption('450')
  await expect(page.getByRole('heading', { name: 'Aucune partie ne correspond.' })).toBeVisible()
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click()
  await expect(page.locator('.match-row')).toHaveCount(5)
  await page.locator('.match-row button').first().focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('42')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.match-row button').first()).toBeFocused()
  expect(errors).toEqual([])
})

test('mobile review cards, menu and history remain within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockReview(page)
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.getByRole('heading', { name: 'À revoir' })).toBeVisible()
  await expect(page.locator('.review-card')).toHaveCount(2)
  await page.locator('.review-detail').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Fermer les détails' }).click()
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
  await page.getByRole('link', { name: 'Historique des parties', exact: true }).click()
  await expect(page.locator('.match-row')).toHaveCount(5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('combobox', { name: 'Rôle', exact: true }).selectOption('NONE')
  await expect(page.locator('.match-row')).toHaveCount(1)
  await expect(page.locator('.match-row')).toContainText('Ahri')
})

test('empty and partial histories never show invented statistics', async ({ page }) => {
  const empty = makeReview()
  empty.matches = []
  empty.summary = {
    games: 0,
    wins: 0,
    winRate: null,
    kda: null,
    deathless: false,
    mainRole: null,
    champions: [],
    reviewIds: [],
  }
  empty.sample.found = 0
  await page.route('**/api/review?*', (route) => route.fulfill({ json: empty }))
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.getByRole('heading', { name: 'L’histoire reste à écrire.' })).toBeVisible()
  await expect(page.locator('.stat-wins')).toContainText('—')
  await page.unroute('**/api/review?*')
  const partial = makeReview()
  partial.sample.unavailable = 2
  partial.sample.found = 12
  await page.route('**/api/review?*', (route) => route.fulfill({ json: partial }))
  await page.reload()
  await expect(page.getByText('Chargement partiel :', { exact: false })).toBeVisible()
})

test('rate limit shows Retry-After and keeps retry disabled until the deadline', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/review?*', (route) => {
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
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeDisabled()
  await expect(page.getByRole('timer')).toContainText('Nouvelle recherche possible')
  expect(requests).toBe(1)
})

test('server rejects malformed Riot IDs before any external calls', async ({ request }) => {
  const response = await request.get('/api/review?riotId=invalid')
  expect(response.status()).toBe(400)
  const body = await response.json()
  expect(body.data.code).toBe('INVALID_RIOT_ID')
  expect(JSON.stringify(body)).not.toContain('X-Riot-Token')
})

test('capture the three reference views and the welcome screen', async ({ page }) => {
  await mockReview(page)
  await page.goto('/')
  await page.screenshot({ path: 'docs/screenshots/welcome.png', fullPage: true })
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.locator('.overview-panels')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'docs/screenshots/profile-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Voir plus' }).click()
  await expect(page.locator('.match-row')).toHaveCount(5)
  await page.screenshot({ path: 'docs/screenshots/history-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 577, height: 1024 })
  await page.goto('/?joueur=NamiMain%23MDS')
  await expect(page.getByRole('heading', { name: 'À revoir' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/profile-mobile.png', fullPage: true })
})

test('profile and history do not overflow at mobile and tablet breakpoints', async ({ page }) => {
  await mockReview(page)
  for (const width of [320, 577, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/historique']) {
      await page.goto(`${path}?joueur=NamiMain%23MDS`)
      await page.locator('.profile-hero,.history-heading').waitFor()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${path} at ${width}px`,
      ).toBe(true)
    }
  }
})
