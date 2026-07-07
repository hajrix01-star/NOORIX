import type { ApiParsedResult, ChatQueryRequest, ChatQueryResponse } from '../../../types/api';
import { apiPost } from '../../core/apiHttp';

export async function chatQuery(query: string): Promise<ApiParsedResult<ChatQueryResponse>> {
  const body: ChatQueryRequest = { query };
  return apiPost('/api/v1/chat/query', body);
}
