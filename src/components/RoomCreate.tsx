import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, Info, Lock } from 'lucide-react';

interface RoomCreateProps {
  onRoomCreated: (roomId: string, adminPassword: string, nickname: string) => void;
  onOpenAdmin: () => void;
  loggedInAdmin: string | null;
}

export default function RoomCreate({ onRoomCreated, onOpenAdmin, loggedInAdmin }: RoomCreateProps) {
  const [name, setName] = useState('AI 时代的人类价值');
  const [description, setDescription] = useState('探讨通用人工智能对社会分工和人类主体性的深远冲击');
  const [nature, setNature] = useState('严谨理性、辩证思考中带有适度的犀利点评，要求论点扎实');
  const [expectedOutcome, setExpectedOutcome] = useState('输出 3 条人类应对自动化浪潮的不可替代性核心优势与建议');
  const [password, setPassword] = useState('123456');
  const [agentNickname, setAgentNickname] = useState('龙门客栈掌柜');
  
  // Custom generated agent prompt
  const [agentPrompt, setAgentPrompt] = useState('');
  const [generatingAgent, setGeneratingAgent] = useState(false);
  const [creatorNickname, setCreatorNickname] = useState('发起人老张');
  const [errorMessage, setErrorMessage] = useState('');

  const handleGenerateAgent = async () => {
    if (!name.trim() || !description.trim() || !nature.trim() || !expectedOutcome.trim() || !agentNickname.trim()) {
      setErrorMessage('请填写所有必需的控制定义项，以便生成协调 Agent。');
      return;
    }
    
    setGeneratingAgent(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/rooms/generate-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          nature: nature.trim(),
          expectedOutcome: expectedOutcome.trim(),
          agentNickname: agentNickname.trim()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setAgentPrompt(data.agentPrompt);
      } else {
        setErrorMessage(data.error || '生成 Agent 失败，请检查管理员后台的大模型密钥设置。');
      }
    } catch (err: any) {
      setErrorMessage('云端服务器连接异常，可以于右上方配置可用大模型 key 端点。');
    } finally {
      setGeneratingAgent(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim() || !creatorNickname.trim() || !agentNickname.trim()) {
      setErrorMessage('请填写完整的核心信息');
      return;
    }

    if (!agentPrompt) {
      setErrorMessage('建立房间前，请先点击【生成 Agent 角色】按钮构建控制议程的 AI。');
      return;
    }

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          nature: nature.trim(),
          expectedOutcome: expectedOutcome.trim(),
          password: password.trim(),
          agentNickname: agentNickname.trim(),
          agentPrompt: agentPrompt.trim(),
          adminId: loggedInAdmin || 'admin' // Pass owner admin account identifier
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onRoomCreated(data.roomId, password, creatorNickname.trim());
      } else {
        setErrorMessage(data.error || '创建聊天室失败');
      }
    } catch (err) {
      setErrorMessage('服务器通讯网络异常，创建聊天室遇到阻碍');
    }
  };

  // If administrator is NOT logged in, show an incredibly clean blocking banner guiding them to log in first.
  if (!loggedInAdmin) {
    return (
      <div className="max-w-xl mx-auto border-4 border-black bg-white p-8 text-center space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-12" id="block_creation_unauth">
        <div className="flex justify-center">
          <div className="border-2 border-black p-4 bg-neutral-50 rounded-none inline-block">
            <Lock className="w-8 h-8 text-black" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black font-mono uppercase tracking-tight text-black">需要管理员身份验证</h2>
          <p className="text-xs text-neutral-500 font-mono leading-relaxed px-4">
            因龙门阵采用<strong>高保密隔离机制</strong>：只有登录后的各管理员可以独立维护、开辟自己管辖下的专属聊天室（各管理员创建的会话互不可见、互不干扰）。
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onOpenAdmin}
            className="w-full bg-black text-white hover:bg-neutral-100 hover:text-black border-2 border-black py-2.5 px-4 font-mono font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            立即登录 / 在此激活种子管理员账号 ⚙️
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 font-mono">
          * 新开通的子管理员账号也将可以自由注册开辟房间。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto border-2 border-black bg-white p-6 md:p-8" id="create_view_container">
      {/* Header Info */}
      <div className="border-b-2 border-black pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="create_view_header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black font-sans">开辟新龙门阵</h1>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            —— 管理员 [<strong>{loggedInAdmin}</strong>] 正准备主持一场研讨会
          </p>
        </div>
        <button
          onClick={onOpenAdmin}
          className="border-2 border-black px-3 py-1.5 text-xs font-mono bg-neutral-100 hover:bg-black hover:text-white transition-all text-black cursor-pointer"
          id="btn_view_config"
        >
          后台配置 Key ⚙
        </button>
      </div>

      <form onSubmit={handleCreateRoom} className="space-y-6" id="create_room_form">
        {/* Step 1: Definition of Content & Nature */}
        <div className="space-y-4" id="section_definition">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
            <span className="w-2 h-2 bg-black inline-block"></span>
            1. 研讨目标与调性定义 (Content & Theme)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-black">龙门阵主题</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: AI 时代的人类生存论"
                className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none text-left"
                id="input_room_name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-black">你的主事人昵称</label>
              <input
                type="text"
                value={creatorNickname}
                onChange={(e) => setCreatorNickname(e.target.value)}
                placeholder="你的名号，如: 发起人老张"
                className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none text-left"
                id="input_creator_nickname"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-black">话题背景与论据</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述参与人员所需聚焦的具体议题内容..."
              className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none text-left"
              id="textarea_description"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-black">研讨调性风格</label>
              <input
                type="text"
                value={nature}
                onChange={(e) => setNature(e.target.value)}
                placeholder="例如: 针锋相对辩论、和风细雨吐槽、头脑风暴..."
                className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none text-left"
                id="input_nature"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-black font-mono">
                最终预期达成目标成果
              </label>
              <input
                type="text"
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="例如: 论证出一个行动方案、达成共识建议等..."
                className="w-full bg-white border-2 border-black p-2 text-sm text-black focus:outline-none text-left"
                id="input_outcome"
                required
              />
            </div>
          </div>
        </div>

        {/* Step 2: AI Agent Generator */}
        <div className="space-y-4 pt-2" id="section_agent_generation">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
            <span className="w-2 h-2 bg-black inline-block"></span>
            2. 生成协调讨论的控制 AI Agent (Conductor Agent)
          </h3>

          <div className="bg-neutral-50 p-4 border-2 border-dashed border-black space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1">
                <label className="block text-xs font-bold mb-1 text-black">
                  AI 控制器/助理的主角名称:
                </label>
                <input
                  type="text"
                  value={agentNickname}
                  onChange={(e) => setAgentNickname(e.target.value)}
                  placeholder="如: 茶楼掌柜、冷面裁判、灵感捕手"
                  className="bg-white border-2 border-black p-2 text-sm w-full md:max-w-xs text-black focus:outline-none text-left"
                  id="input_agent_nickname"
                  required
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateAgent}
                disabled={generatingAgent}
                className="w-full md:w-auto border-2 border-black bg-black text-white text-xs font-mono font-bold px-4 py-2.5 hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                id="btn_generate_agent"
              >
                {generatingAgent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>正在淬炼 Agent...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>生成 Agent 角色</span>
                  </>
                )}
              </button>
            </div>

            {agentPrompt ? (
              <div className="space-y-1 sm:space-y-2 animate-fade-in" id="agent_instructions_box">
                <label className="block text-xs font-semibold text-black flex items-center gap-1">
                  <span>AI 角色内嵌指令 (System prompt) — 可点击在框内编辑微调:</span>
                </label>
                <textarea
                  rows={4}
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  className="w-full bg-white border-2 border-black p-2 text-xs font-mono text-black leading-relaxed focus:outline-none text-left"
                  id="textarea_agent_prompt"
                />
                <span className="text-[10px] text-emerald-700 font-semibold block text-right">
                  ✓ 已经淬炼生成！您能直接编辑以上的设定文本来限制 AI 的性格与发言频率。
                </span>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 font-mono bg-white p-3 border border-black flex gap-2 items-center" id="agent_empty_state">
                <Info className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>
                  请先在上方设定话题，并点击“生成 Agent 角色”获取基于大模型淬炼的主持人指令。
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Password & Create */}
        <div className="border-t-2 border-black pt-5 space-y-4" id="section_security">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-black">
                本场密码 (新加入者必须要输入它)
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="不要留空"
                className="w-full bg-white border-2 border-black p-2 text-sm text-black font-mono focus:outline-none text-left animate-fade-in"
                id="input_password"
                required
              />
            </div>
            
            <div className="flex flex-col justify-end">
              <span className="text-[11px] text-neutral-500 leading-tight">
                * <strong>高隐私性保障</strong>：聊天历史随进程实时记录，一旦本场龙门阵关闭，服务器内存会<strong>立刻清零并彻底销毁</strong>全部对话内容，任何人无法通过链接找回聊天痕迹。
              </span>
            </div>
          </div>
        </div>

        {/* Submit */}
        {errorMessage && (
          <div className="p-3 bg-red-50 text-red-800 border-2 border-red-500 text-xs font-mono flex items-center gap-2" id="create_error_msg">
            <span className="font-bold">失败:</span> {errorMessage}
          </div>
        )}

        <div className="pt-2 flex justify-end" id="submit_form_box">
          <button
            type="submit"
            className="w-full md:w-auto border-2 border-black bg-black text-white px-6 py-3 font-semibold font-mono tracking-tight text-sm hover:bg-white hover:text-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            id="btn_spawn_room"
          >
            <span>发起这场龙门阵</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </form>
    </div>
  );
}
