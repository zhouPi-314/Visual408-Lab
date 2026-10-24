// 三种深度优先遍历：差别只在访问语句的位置
#include <string>
#include <vector>

struct Node {
    std::string v;
    Node* left = nullptr;
    Node* right = nullptr;
};

void traverse(Node* n, std::vector<std::string>& out) {
    if (!n) return;                                   // 空子树：直接返回
    // 先序：这一行在左右递归之前；中序在两者之间；后序在之后
    out.push_back(n->v);                              // 访问点
    traverse(n->left, out);
    traverse(n->right, out);
}
