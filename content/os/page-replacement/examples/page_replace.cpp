// 页面置换：FIFO / LRU / OPT 的判定骨架（教学示意，非可编译实现）
#include <array>
#include <vector>

constexpr int kFrames = 3;
struct Frame { int page = -1; long lastUsed = -1; long loadedAt = -1; };

int simulate(const std::vector<int>& ref, int alg) {
    for (auto& f : frames) if (f.page == page) { f.lastUsed = i; hit = true; }
    if (hit) continue;
    ++faults;
    int victim = chooseVictim(alg, frames);  // FIFO / LRU / OPT
    load(victim, page);
}
