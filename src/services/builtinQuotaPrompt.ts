/**
 * 公益额度不够时的提示：今天还没签到就引导签到；签过了还不够，就说明已用完，引导切回自己的 API。
 * aiService 在请求被拒时调用。短时间内只弹一次，避免重试或并发请求连弹。
 */
import { confirmDialog } from '@/composables/useDialog';
import { usePublicApi } from '@/composables/usePublicApi';
import { formatCredit } from '@/services/builtinApi';
import { toast } from '@/utils/toast';

let lastShown = 0;
let showing = false;

export async function promptBuiltinQuota(): Promise<void> {
  if (showing || Date.now() - lastShown < 15_000) return;
  showing = true;
  lastShown = Date.now();
  try {
    const p = usePublicApi();
    await p.refreshWallet();
    const wallet = p.wallet.value;
    if (!wallet) {
      toast.warning('公益额度不足，请登录云端账号后签到领取');
      return;
    }

    if (!wallet.checked_in_today) {
      const lottery = wallet.rules.mode === 'lottery';
      const ok = await confirmDialog({
        title: '公益额度不足',
        message: `当前额度 ${formatCredit(wallet.balance)}，今天还没签到。${lottery ? '签到抽签' : '签到'}后就能继续使用公益 API。`,
        confirmText: lottery ? '签到抽签' : '签到领取',
        cancelText: '稍后',
      });
      if (!ok) return;
      const res = await p.checkIn();
      if (res) toast.success(`${res.tier ? `抽中「${res.tier}」，` : ''}获得 ${formatCredit(res.amount)} 额度，可以重新发送了`);
      return;
    }

    const ok = await confirmDialog({
      title: '今日公益额度已用完',
      message: `当前额度 ${formatCredit(wallet.balance)}，今天已经签到过了，明天可以再签到领取。现在可以切回你自己的 API 继续游戏。`,
      confirmText: '切回我的 API',
      cancelText: '知道了',
    });
    if (ok) p.useOwn();
  } finally {
    showing = false;
  }
}
