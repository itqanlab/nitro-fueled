import { log, error } from './logger';
import { randomUUID } from 'crypto';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const users = new Map<string, User>();

export function createUser(name: string, email: string): User {
  const id = randomUUID();
  const user: User = { id, name, email, createdAt: new Date() };
  users.set(id, user);
  log(`User created: ${id} - ${name}`);                       // console call 1 (via imported log)
  return user;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function deleteUser(id: string): boolean {
  const user = users.get(id);
  if (!user) {
    console.error(`Failed to delete: user ${id} not found`);   // console call 2 (direct console)
    return false;
  }
  users.delete(id);
  console.log(`User deleted: ${id}`);                          // console call 3 (direct console)
  return true;
}
