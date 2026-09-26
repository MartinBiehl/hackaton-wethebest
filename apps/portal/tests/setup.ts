import * as matchers from '@testing-library/jest-dom/matchers'
import { afterEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
expect.extend(matchers)
afterEach(() => { cleanup(); sessionStorage.clear(); window.location.hash = '' })
window.scrollTo = vi.fn()
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
