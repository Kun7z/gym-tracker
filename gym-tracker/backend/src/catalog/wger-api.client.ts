import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WgerPage } from './wger.types';

@Injectable()
export class WgerApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('WGER_BASE_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    this.token = this.config.get<string>('WGER_API_TOKEN') ?? '';
  }

  get enabled(): boolean {
    return this.baseUrl.length > 0;
  }

  async fetchAll<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = `${this.baseUrl}/api/v2${path}`;
    while (url) {
      const page: WgerPage<T> = await this.getJson<WgerPage<T>>(url);
      items.push(...page.results);
      url = page.next;
    }
    return items;
  }

  private async getJson<T>(url: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) {
      headers.Authorization = `Token ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new Error(
        `Falha de rede ao acessar o wger (${url}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      throw new Error(`wger respondeu HTTP ${response.status} em ${url}`);
    }
    return (await response.json()) as T;
  }
}
