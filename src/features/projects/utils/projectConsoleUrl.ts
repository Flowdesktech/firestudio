import { Project, GoogleAccount } from '../store/projectsSlice';

export type ConsoleService = 'firestore' | 'storage' | 'authentication';

export function getConsoleUrl(
  project: Pick<Project, 'authMethod' | 'projectId' | 'emulatorHost' | 'emulatorServices'>,
  service: ConsoleService,
  ...args: string[]
): string {
  if (project.authMethod === 'emulator') {
    const ui = project.emulatorServices?.ui;
    const host = ui?.host || project.emulatorHost?.split(':')[0] || 'localhost';
    const port = ui?.port ?? 4000;

    return `http://${host}:${port}/${service}`;
  }

  switch (service) {
    case 'firestore': {
      const collection = args[0];

      return `https://console.firebase.google.com/project/${project.projectId}/firestore${collection ? `/data/${collection}` : ''}`;
    }
    case 'storage':
      return `https://console.firebase.google.com/project/${project.projectId}/storage`;
    case 'authentication':
      return `https://console.firebase.google.com/project/${project.projectId}/authentication/users`;
  }
}

export function getConsoleLabel(project: Pick<Project, 'authMethod'> | GoogleAccount): string {
  if ('authMethod' in project) {
    return project.authMethod === 'emulator' ? 'Open in Emulator UI' : 'Reveal in Firebase Console';
  }
  return 'Reveal in Firebase Console';
}
