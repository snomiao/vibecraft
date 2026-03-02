import { expect, test } from '@playwright/test';
import { launchTestApp } from './utils';
import type { AgentProvider } from '../../src/shared/types';

test.setTimeout(120_000);

const providers: AgentProvider[] = ['claude', 'codex', 'cursor'];

test('new agents default to the last selected model per provider', async () => {
  const { page, cleanup, paths } = await launchTestApp({ integrationMode: false, startInWorkspace: true });
  page.setDefaultTimeout(15_000);

  try {
    await expect(page.getByTestId('workspace-canvas')).toBeVisible();

    for (const [index, provider] of providers.entries()) {
      const modelId = `test-model-${provider}-${index}`;
      const result = await page.evaluate(
        async ({ workspacePath, provider, modelId, index }) => {
          const folder = await window.electronAPI.createFolder(
            workspacePath,
            `models-folder-${provider}-${index}`,
            100 + index * 40,
            120 + index * 40
          );
          if (!folder.success || !folder.folder) {
            return { error: 'folder' };
          }

          const first = await window.electronAPI.spawnAgent({
            provider,
            name: `${provider}-agent-${index}-a`,
            displayName: `${provider}-agent-${index}-a`,
            color: '#ff00ff',
            workspacePath,
            x: 200 + index * 40,
            y: 200 + index * 40,
          });
          if (!first.success || !first.agent) {
            return { error: 'spawn-first' };
          }

          const update = await window.electronAPI.updateAgentModel(first.agent.id, modelId);
          if (!update.success) {
            return { error: 'update-model' };
          }

          const attach = await window.electronAPI.agentAttachToFolder({
            workspacePath,
            agentId: first.agent.id,
            folderId: folder.folder.id,
            relativePath: folder.folder.relativePath,
          });
          if (!attach.success) {
            return { error: 'attach' };
          }

          const second = await window.electronAPI.spawnAgent({
            provider,
            name: `${provider}-agent-${index}-b`,
            displayName: `${provider}-agent-${index}-b`,
            color: '#ff00ff',
            workspacePath,
            x: 240 + index * 40,
            y: 240 + index * 40,
          });
          if (!second.success || !second.agent) {
            return { error: 'spawn-second' };
          }

          return { model: second.agent.model };
        },
        { workspacePath: paths.workspace, provider, modelId, index }
      );

      expect(result.error).toBeUndefined();
      expect(result.model).toBe(modelId);
    }
  } finally {
    await cleanup();
  }
});
