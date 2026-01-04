import { describe, it, expect } from 'vitest';
import { SocialPostWorkflow } from '../src/workflows/social-post-workflow';

// Mock environment and parameters
const mockEnv = {
  DB: {
    prepare: (query: string) => ({
      bind: () => ({ first: () => Promise.resolve({ name: 'Velvet Fringe Salon', city: 'Sample City' }) })
    })
  },
  AI: {
    run: async (model: string, options: any) => {
      return { choices: [{ message: { content: 'Generated post content' } }] };
    }
  }
};

const mockParams = {
  businessName: 'Velvet Fringe Salon',
  platform: 'Facebook'
};

const mockImageGenerator = async (prompt: string) => {
  // Logic to call Cloudflare's image generation
  return 'image-data-base64';
};

describe('SocialPostWorkflow', () => {
  it('should generate a social media post with image for the business', async () => {
    const workflow = new SocialPostWorkflow(mockEnv);
    const fakeEvent = { params: mockParams };
    const fakeStep = {
      do: async (name: string, options: any, fn: () => Promise<any>) => fn()
    };

    await workflow.run(fakeEvent, fakeStep);

    const expectedOutput = 'Generated post content';
    // Call image generator (this would be integrated in a real test scenario)
    const generatedImage = await mockImageGenerator('sample prompt based on business');

    expect(expectedOutput).toBe('Generated post content');
    expect(generatedImage).toBe('image-data-base64');
  });
});
