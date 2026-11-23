import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Sandbox } from './Sandbox';

const Root: React.FC = () => (
  <>
    <Composition id="PaperTest" component={Sandbox as any} width={1080} height={1920} fps={30} durationInFrames={90}
      defaultProps={{ scene: 'cell' }} />
  </>
);
registerRoot(Root);
