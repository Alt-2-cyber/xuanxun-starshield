import localUnitTest from './LocalUnit.test';
import pairingProtocolTest from './PairingProtocol.test';
import edgeMessageRouterTest from './EdgeMessageRouter.test';
import edgeClientContractTest from './EdgeClientContract.test';
import eventHistoryTest from './EventHistory.test';

export default function testsuite() {
  localUnitTest();
  pairingProtocolTest();
  edgeMessageRouterTest();
  edgeClientContractTest();
  eventHistoryTest();
}
