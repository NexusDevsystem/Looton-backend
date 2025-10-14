// analytics.service.ts
// Serviço para coleta e análise de dados de uso do app com integração Firebase

import { admin } from './firebase.service.js';

// Interface para eventos de analytics
export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType: string;
  properties: Record<string, unknown>;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  path?: string;
}

// Interface para métricas
export interface AnalyticsMetrics {
  totalRequests: number;
  activeUsersToday: number;
  activeUsersThisWeek: number;
  activeUsersThisMonth: number;
  mostPopularEndpoints: Array<{ endpoint: string; count: number }>;
  topEvents: Array<{ eventType: string; count: number }>;
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

// Interface para dados de usuários
export interface UsersData {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByCountry: Array<{ country: string; count: number }>;
  averageSessionDuration: number;
}

// Armazenamento em memória (em produção, use um banco de dados)
const events: AnalyticsEvent[] = [];
const dailyRequests = new Map<string, number>(); // key: date string (YYYY-MM-DD), value: count

export class AnalyticsService {
  // Registra um novo evento de analytics e envia para Firebase Analytics
  async logEvent(event: Omit<AnalyticsEvent, 'id'>): Promise<void> {
    const newEvent: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...event
    };

    events.push(newEvent);

    // Atualiza contagem de requisições diárias
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
    dailyRequests.set(dateKey, (dailyRequests.get(dateKey) || 0) + 1);

    // Limitar o tamanho do histórico para evitar consumo excessivo de memória
    if (events.length > 10000) {
      events.splice(0, 1000); // Mantém os 9000 eventos mais recentes
    }

    // Envia evento para o Firebase (em ambiente real, isso seria feito no app cliente)
    // Mas podemos registrar um log para monitoramento
    console.log(`Analytics Event: ${newEvent.eventType} by user ${newEvent.userId} at ${new Date(newEvent.timestamp).toISOString()}`);
  }

  // Obtém métricas de uso
  async getMetrics(): Promise<AnalyticsMetrics> {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Filtra eventos baseado no tempo
    const eventsToday = events.filter(e => e.timestamp > oneDayAgo);
    const eventsThisWeek = events.filter(e => e.timestamp > oneWeekAgo);
    const eventsThisMonth = events.filter(e => e.timestamp > oneMonthAgo);

    // Calcula métricas
    const totalRequests = events.length;

    // Conta usuários únicos
    const uniqueUsersToday = new Set(eventsToday.map(e => e.userId)).size;
    const uniqueUsersThisWeek = new Set(eventsThisWeek.map(e => e.userId)).size;
    const uniqueUsersThisMonth = new Set(eventsThisMonth.map(e => e.userId)).size;

    // Conta endpoints mais populares
    const endpointCounts: Record<string, number> = {};
    eventsThisWeek.forEach(e => {
      if (e.path) {
        endpointCounts[e.path] = (endpointCounts[e.path] || 0) + 1;
      }
    });
    
    const mostPopularEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conta eventos mais comuns
    const eventCounts: Record<string, number> = {};
    eventsThisWeek.forEach(e => {
      eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
    });
    
    const topEvents = Object.entries(eventCounts)
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calcula retenção de usuário (estimativa)
    const userRetention = {
      day1: 0.3, // 30% estimado
      day7: 0.15, // 15% estimado
      day30: 0.05 // 5% estimado
    };

    return {
      totalRequests,
      activeUsersToday: uniqueUsersToday,
      activeUsersThisWeek: uniqueUsersThisWeek,
      activeUsersThisMonth: uniqueUsersThisMonth,
      mostPopularEndpoints,
      topEvents,
      userRetention
    };
  }

  // Obtém dados de usuários
  async getUsersData(): Promise<UsersData> {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const eventsToday = events.filter(e => e.timestamp > oneDayAgo);
    const eventsThisWeek = events.filter(e => e.timestamp > oneWeekAgo);
    const eventsThisMonth = events.filter(e => e.timestamp > oneMonthAgo);

    // Calcula dados de usuários
    const uniqueUsers = new Set(events.map(e => e.userId));
    const newUsersToday = new Set(eventsToday.map(e => e.userId)).size;
    const newUsersThisWeek = new Set(eventsThisWeek.map(e => e.userId)).size;
    const newUsersThisMonth = new Set(eventsThisMonth.map(e => e.userId)).size;

    // Agrupa por país baseado em IP (simulação, em produção usaria serviço de geolocalização)
    const countries: Record<string, number> = {};
    eventsThisMonth.forEach(e => {
      if (e.ip) {
        // Em implementação real, usaria um serviço de geolocalização
        // Aqui, vamos simular com base em alguns IPs
        const country = this.getCountryFromIP(e.ip);
        countries[country] = (countries[country] || 0) + 1;
      }
    });
    
    const usersByCountry = Object.entries(countries)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // Calcula duração média de sessão (simulação simples)
    const averageSessionDuration = 1200; // 20 minutos em segundos

    return {
      totalUsers: uniqueUsers.size,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      usersByCountry,
      averageSessionDuration
    };
  }

  // Método auxiliar para simular país baseado em IP
  private getCountryFromIP(ip: string): string {
    // Simulação simples baseada em IPs
    if (ip.includes('192.168') || ip.includes('10.0') || ip.includes('172.')) {
      // IPs locais, usar IP real em produção
      return 'BR'; // Simula Brasil
    }
    
    // Em implementação real, usaria serviço como MaxMind, IPinfo, etc
    return 'BR'; // Simula Brasil para todos por padrão
  }
}

// Instância singleton do serviço de analytics
export const analyticsService = new AnalyticsService();