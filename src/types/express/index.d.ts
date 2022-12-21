import { Profile } from '../profile.types';
// to make the file a module and avoid the TypeScript error

declare global {
  namespace Express {
    export interface Request {
      profile?: Profile;
    }
    export interface Response {
      profile?: Profile;
    }
  }
}
