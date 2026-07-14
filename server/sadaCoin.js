import axios from 'axios';

const SADA_API_URL = 'https://coin.sada.ai.kr/api';

export class SadaCoinClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: SADA_API_URL,
      headers: {
        'X-API-Key': apiKey,
      },
    });
  }

  async getClubInfo() {
    try {
      const response = await this.client.get('/me');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get club info: ${error.message}`);
    }
  }

  async getStudentInfo(studentId) {
    try {
      const response = await this.client.get(`/students/${studentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get student info: ${error.message}`);
    }
  }

  async createPaymentRequest(studentId, amount, title, type = 'student_to_club') {
    try {
      const response = await this.client.post('/payment-requests', {
        student_id: studentId,
        amount,
        title,
        type,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create payment request: ${error.message}`);
    }
  }

  async transfer(studentHash, amount, title, type = 'student_to_club') {
    try {
      const response = await this.client.post('/transfer', {
        student_hash: studentHash,
        amount,
        title,
        type,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to transfer: ${error.message}`);
    }
  }

  async getTransactions() {
    try {
      const response = await this.client.get('/transactions/me');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }
}
