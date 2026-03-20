/** Shared YAML import logic for toolbar, homepage, and drag-drop */

export async function importYamlFile(
  file: File
): Promise<{ flowId: string; nodeCount: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/flows/import/yaml', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Import failed' }));
    throw new Error(err.error || 'Import failed');
  }

  return res.json();
}

/** Open a file picker and import the selected YAML file */
export function pickAndImportYaml(): Promise<{ flowId: string; nodeCount: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const result = await importYamlFile(file);
        resolve(result);
      } catch (err) {
        resolve(null);
        throw err;
      }
    };
    input.click();
  });
}
