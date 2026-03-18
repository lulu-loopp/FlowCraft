import { test, expect } from '@playwright/test'

test('T9: Playground - visit, send message, check response', async ({ page }) => {
  await page.goto('/playground')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'doc/review-screenshots/T9-playground.png', fullPage: true })

  // Check page loaded
  const url = page.url()
  console.log('URL:', url)
  const is404 = await page.locator('text=404').isVisible().catch(() => false)
  console.log('Is 404:', is404)

  if (is404) {
    console.log('Playground page returns 404 - feature may not exist')
    return
  }

  // Find message input
  const messageInput = page.locator('textarea, input[type="text"]').first()
  const inputVisible = await messageInput.isVisible().catch(() => false)
  console.log('Message input visible:', inputVisible)

  if (inputVisible) {
    await messageInput.fill('Hello, can you help me test?')
    console.log('Message typed')

    // Find send button
    const sendBtn = page.locator('button').filter({ hasText: /send|发送|submit|→|➤/i }).first()
    const sendVisible = await sendBtn.isVisible().catch(() => false)
    console.log('Send button visible:', sendVisible)

    if (sendVisible) {
      await sendBtn.click()
      console.log('Send clicked')
      await page.waitForTimeout(3000)
    } else {
      // Try pressing Enter
      await messageInput.press('Enter')
      console.log('Pressed Enter')
      await page.waitForTimeout(3000)
    }

    await page.screenshot({ path: 'doc/review-screenshots/T9-after-send.png', fullPage: true })

    // Check for loading or error indicators
    const loading = page.locator('[class*="loading"], [class*="spinner"], [class*="animate"]')
    console.log('Loading indicators:', await loading.count())

    const error = page.locator('[class*="error"], [role="alert"]').filter({ hasText: /error|fail|错误/i })
    const errorVisible = await error.first().isVisible().catch(() => false)
    console.log('Error visible:', errorVisible)
    if (errorVisible) {
      console.log('Error text:', await error.first().textContent())
    }

    // Check for response messages
    const messages = page.locator('[class*="message"], [class*="chat"], [class*="bubble"]')
    console.log('Message elements:', await messages.count())
  } else {
    console.log('No message input found on playground page')
    // Log what's on the page
    const bodyText = await page.textContent('body')
    console.log('Page content preview:', bodyText?.substring(0, 300))
  }
})
