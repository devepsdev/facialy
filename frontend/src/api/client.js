import axios from 'axios';

const client = axios.create({
  baseURL: '/facialy/api/',
});

export default client;