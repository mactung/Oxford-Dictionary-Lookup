import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Chrome API
global.chrome = {
    runtime: {
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
        },
        getURL: vi.fn(),
        id: 'test-extension-id'
    },
    storage: {
        local: {
            get: vi.fn((keys, callback) => callback({})),
            set: vi.fn(),
        },
        onChanged: {
            addListener: vi.fn(),
        }
    },
    alarms: {
        create: vi.fn(),
        onAlarm: {
            addListener: vi.fn(),
        }
    },
    tabs: {
        sendMessage: vi.fn(),
        query: vi.fn()
    }
}

// Mock Audio
global.Audio = vi.fn().mockImplementation(() => ({
    play: vi.fn(),
}));

// ResizeObserver mock
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));
