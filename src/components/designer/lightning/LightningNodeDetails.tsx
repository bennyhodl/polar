import React, { ReactNode, useState } from 'react';
import { useAsync } from 'react-async-hook';
import { Alert, Icon } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { LightningNode, Status } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { abbreviate } from 'utils/numbers';
import { Loader } from 'components/common';
import SidebarCard from '../SidebarCard';
import { ActionsTab, ConnectTab, InfoTab } from './';

interface Props {
  node: LightningNode;
}

const LightningDetails: React.FC<Props> = ({ node }) => {
  const { l } = usePrefixedTranslation('cmps.designer.lightning.LightningNodeDetails');
  const [activeTab, setActiveTab] = useState('info');
  const { getInfo, getBalances } = useStoreActions(s => s.lightning);

  const getInfoAsync = useAsync(
    async (node: LightningNode) => {
      if (node.status === Status.Started) {
        await getInfo(node);
        await getBalances(node);
      }
    },
    [node],
  );

  let extra: ReactNode | undefined;
  const { nodes } = useStoreState(s => s.lightning);
  const nodeState = nodes[node.name];
  if (node.status === Status.Started && nodeState) {
    if (nodeState.balances) {
      const { confirmed } = nodeState.balances;
      extra = <strong>{abbreviate(confirmed)} sats</strong>;
    }
  }

  const tabHeaders = [
    { key: 'info', tab: l('info') },
    { key: 'connect', tab: l('connect') },
    { key: 'actions', tab: l('actions') },
  ];
  const tabContents: Record<string, ReactNode> = {
    info: <InfoTab node={node} />,
    connect: <ConnectTab node={node} />,
    actions: <ActionsTab node={node} />,
  };
  return (
    <SidebarCard
      title={node.name}
      extra={extra}
      tabList={tabHeaders}
      activeTabKey={activeTab}
      onTabChange={setActiveTab}
    >
      {node.status === Status.Starting && (
        <Alert
          type="info"
          showIcon
          icon={<Icon type="loading" />}
          closable={false}
          message={l('waitingNotice', { implementation: node.implementation })}
        />
      )}
      {node.status !== Status.Started && !nodeState && getInfoAsync.loading && <Loader />}
      {getInfoAsync.error && node.status === Status.Started && (
        <Alert
          type="error"
          closable={false}
          message={l('connectError')}
          description={getInfoAsync.error.message}
        />
      )}
      {tabContents[activeTab]}
    </SidebarCard>
  );
};

export default LightningDetails;