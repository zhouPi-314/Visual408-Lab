// Cache 直接映射：一次访问的完整判定（教学示意，不是真实硬件实现）
#include <cstdint>

struct Line { bool valid = false; std::uint32_t tag = 0; std::uint32_t block = 0; };

struct DirectCache {
    Line lines[8];
    int hits = 0, misses = 0;

    bool access(std::uint32_t addr) {
        const std::uint32_t offset = addr & 0xF;          // 低 4 位：块内偏移
        const std::uint32_t line   = (addr >> 4) & 0x7;   // 中间 3 位：行号
        const std::uint32_t tag    = addr >> 7;           // 高位：标记
        // 命中判定只看「这一行当前的 tag」
        if (lines[line].valid && lines[line].tag == tag) { ++hits; return true; }
        ++misses;
        lines[line] = Line{ true, tag, addr >> 4 };       // 装入（必要时覆盖）
        return false;
    }
};
