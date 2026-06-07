import api from '../utils/api';

/**
 * Send a message to the AI agent
 */
export const sendMessage = async (sessionUuid, message, contextProductId = null) => {
  const response = await api.post('/chat', {
    sessionUuid,
    message,
    contextProductId
  });
  return response.data;
};

/**
 * Fetch all sessions for current authenticated user
 */
export const fetchSessions = async () => {
  const response = await api.get('/chat/sessions');
  return response.data;
};

/**
 * Load history messages for a session
 */
export const fetchMessages = async (sessionUuid) => {
  const response = await api.get(`/chat/sessions/${sessionUuid}/messages`);
  return response.data;
};

/**
 * Delete a session
 */
export const deleteSession = async (sessionUuid) => {
  const response = await api.delete(`/chat/sessions/${sessionUuid}`);
  return response.data;
};
