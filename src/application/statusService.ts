/**
 * StatusService: application service for the `chromato status` subcommand.
 *
 * Single synchronous read + format. No tick loop.
 * Reads state via StatePort, formats via StatusFormatPort.
 *
 * No imports from adapters. No ink/react imports.
 */

import type { StatePort, StatusFormatPort } from '../domain/ports.js';

export class StatusService {
  private readonly statePort: StatePort;
  private readonly formatPort: StatusFormatPort;

  constructor(statePort: StatePort, formatPort: StatusFormatPort) {
    this.statePort = statePort;
    this.formatPort = formatPort;
  }

  getStatus(format: 'tmux' | 'plain'): string {
    const snapshot = this.statePort.readState();

    if (format === 'tmux') {
      return this.formatPort.formatTmux(snapshot);
    }
    return this.formatPort.formatPlain(snapshot);
  }
}
