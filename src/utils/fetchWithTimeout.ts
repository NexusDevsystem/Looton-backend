export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 15000): Promise<Response> {
  // Criar um AbortController para cancelamento
  const controller = new AbortController();
  
  // Configurar timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    // Fazer a requisição com o sinal de abortamento
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    // Cancelar o timeout se a requisição for bem sucedida
    clearTimeout(timeoutId);
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Verificar se o erro foi causado pelo timeout
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    
    // Re-lançar qualquer outro erro
    throw error;
  }
}