import { ClientFromRouter } from '@ui-tars/shared/router';

const ROBOT_API_BASE_URL = 'http://129.254.196.201:8002/v1';

interface RobotAPI {
  sendRobotMessage(messages: { role: string; content: string }[]): Promise<any>;
  getRobotStatus(): Promise<any>;
  executeRobotAction(action: {
    action_type: string;
    target_object?: { name: string };
    target_location?: { name: string };
  }): Promise<any>;
}

const robotApi: RobotAPI = {
  async sendRobotMessage(messages) {
    const response = await fetch(`${ROBOT_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message to robot');
    }

    return response.json();
  },

  async getRobotStatus() {
    const response = await fetch(`${ROBOT_API_BASE_URL}/robot/status`);
    if (!response.ok) {
      throw new Error('Failed to get robot status');
    }
    return response.json();
  },

  async executeRobotAction(action) {
    const response = await fetch(`${ROBOT_API_BASE_URL}/robot/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action),
    });

    if (!response.ok) {
      throw new Error('Failed to execute robot action');
    }

    return response.json();
  },
};

declare global {
  interface Window {
    electron: {
      api: any;
    };
  }
}

export const api = {
  ...window.electron.api,
  ...robotApi,
};
