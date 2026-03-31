# WayShot User Analytics Dashboard

WayShot 付费用户分析看板，数据来源 PostHog。

## 线上地址
https://wayshotdata.xiaomingai.net

## 功能

### 总览页（Dashboard）
- 付费用户分组统计（已流失 / 高价值 / 年费 / 其他）
- 关键指标汇总
- 用户列表入口

### 用户详情页
- 用户信息卡片（累计付费、次数、状态、来源）
- 行为时间线（拍照/上传/保存/续费 按日期聚合）
- 行为趋势图表（拍照/保存/上传/付费 折线图）

## 技术栈
- React 18 + Vite + Tailwind CSS
- Recharts 图表
- PostHog HogQL API
- 数据每天自动同步（cron）

## 提需求
请在 Issues 中提交需求，说明：
1. 需要什么功能/改动
2. 期望的展示方式
3. 优先级（高/中/低）

## 本地开发
```bash
cp .env.example .env
# 填入 PostHog 凭据
npm install
npm run dev
```

## 部署
数据同步 + 构建 + 部署由小明同学自动完成。
