import { ConfigService } from '@nestjs/config';
import { WgerApiClient } from './wger-api.client';

interface FetchInit {
  headers: Record<string, string>;
}

describe('WgerApiClient', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  const configMock = {
    get: jest.fn(
      (key: string) =>
        ({ WGER_BASE_URL: 'http://wger:80', WGER_API_TOKEN: '' })[key],
    ),
  } as unknown as ConfigService;

  const mockPage = (results: unknown[], next: string | null = null) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ count: 1, next, previous: null, results }),
    });

  beforeAll(() => {
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('percorre todas as páginas seguindo o link next', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        mockPage(
          [{ id: 1, name: 'Barbell' }],
          'http://wger:80/api/v2/equipment/?page=2',
        ),
      )
      .mockImplementationOnce(() => mockPage([{ id: 2, name: 'Machine' }]));

    const client = new WgerApiClient(configMock);
    const result = await client.fetchAll<{ id: number }>('/equipment/');

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('envia o token quando configurado', async () => {
    let capturedInit: FetchInit | undefined;
    fetchMock.mockImplementation((_url: string, init: FetchInit) => {
      capturedInit = init;
      return mockPage([]);
    });
    const withToken = {
      get: jest.fn(
        (key: string) =>
          ({ WGER_BASE_URL: 'http://wger:80', WGER_API_TOKEN: 'abc123' })[key],
      ),
    } as unknown as ConfigService;

    const client = new WgerApiClient(withToken);
    await client.fetchAll('/equipment/');

    expect(capturedInit?.headers.Authorization).toBe('Token abc123');
  });

  it('não envia header de autorização sem token', async () => {
    let capturedInit: FetchInit | undefined;
    fetchMock.mockImplementation((_url: string, init: FetchInit) => {
      capturedInit = init;
      return mockPage([]);
    });

    const client = new WgerApiClient(configMock);
    await client.fetchAll('/equipment/');

    expect(capturedInit?.headers.Authorization).toBeUndefined();
  });

  it('lança erro em resposta não-ok', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 500 }),
    );

    const client = new WgerApiClient(configMock);
    await expect(client.fetchAll('/equipment/')).rejects.toThrow('HTTP 500');
  });

  it('reporta falhas de rede com mensagem clara', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const client = new WgerApiClient(configMock);
    await expect(client.fetchAll('/equipment/')).rejects.toThrow(
      /Falha de rede/,
    );
  });
});
