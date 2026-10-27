import { http, HttpResponse } from 'msw'
import greeting from './greeting.json'

/** The answers of MSW, from setupServer under Vitest and from setupWorker in the live preview. */
export const handlers = [http.get('/api/greeting', () => HttpResponse.json(greeting))]
